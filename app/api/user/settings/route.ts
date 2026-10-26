import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ((session.user as any).id || (session.user as any).sub) as string;
    const body = await req.json();
    const { isPublic, showMatchHistory, role } = body;

    // Validate
    const updateValues: Record<string, any> = {};
    const updateClauses: string[] = [];

    if (typeof isPublic === "boolean") {
      updateValues[":pub"] = isPublic;
      updateClauses.push("isPublic = :pub");
    }
    if (typeof showMatchHistory === "boolean") {
      updateValues[":smh"] = showMatchHistory;
      updateClauses.push("showMatchHistory = :smh");
    }
    const userLogin = ((session.user as any).username || "").toLowerCase();
    const userName = (session.user.name || "").toLowerCase();
    const isAdminUser = userLogin === "rishabh9877" || userName === "rishabh9877" || (session.user as any).role === "ADMIN" || (session.user as any).isAdmin === true;

    if (role === "ADMIN") {
      // Platform Admin role CANNOT be assigned or escalated via user settings
      return NextResponse.json(
        { error: "Forbidden: Platform Administrator role cannot be assigned or modified via user settings." },
        { status: 403 }
      );
    } else if (role === "FACULTY") {
      if (isAdminUser) {
        updateValues[":role"] = "FACULTY";
        updateClauses.push("#r = :role");
      } else {
        // Fetch user profile to verify existing faculty status or passcode
        const profRes = await dynamo.send(
          new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
        );
        const isAlreadyFaculty = profRes.Item?.role === "FACULTY" || profRes.Item?.role === "ADMIN";
        const expectedPasscode = process.env.FACULTY_SECRET ? process.env.FACULTY_SECRET.trim().toUpperCase() : null;
        const isPasscodeValid = Boolean(
          expectedPasscode &&
          body.facultyPasscode &&
          body.facultyPasscode.trim().toUpperCase() === expectedPasscode
        );

        // .edu email alone does NOT grant faculty; must be existing verified FACULTY or supply valid FACULTY_SECRET
        if (!isAlreadyFaculty && !isPasscodeValid) {
          return NextResponse.json(
            {
              error: "Faculty credentials required: To access instructor privileges, please enter a valid Faculty Verification Key from your department administrator.",
            },
            { status: 403 }
          );
        }
        updateValues[":role"] = "FACULTY";
        updateClauses.push("#r = :role");
      }
    } else if (role === "INDIVIDUAL" || role === "STUDENT") {
      updateValues[":role"] = role;
      updateClauses.push("#r = :role");
    }

    if (updateClauses.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    const expressionNames: Record<string, string> = {};
    if (updateValues[":role"]) {
      expressionNames["#r"] = "role";
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: "PROFILE" },
        UpdateExpression: `SET ${updateClauses.join(", ")}`,
        ExpressionAttributeValues: updateValues,
        ...(Object.keys(expressionNames).length > 0 ? { ExpressionAttributeNames: expressionNames } : {}),
      })
    );

    return NextResponse.json({ success: true, isPublic, showMatchHistory, role });
  } catch (err: any) {
    console.error("Settings update error:", err);
    return NextResponse.json(
      { error: "Failed to update settings: " + err.message },
      { status: 500 }
    );
  }
}
