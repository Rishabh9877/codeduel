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
    const { isPublic, showMatchHistory } = body;

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

    if (updateClauses.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: "PROFILE" },
        UpdateExpression: `SET ${updateClauses.join(", ")}`,
        ExpressionAttributeValues: updateValues,
      })
    );

    return NextResponse.json({ success: true, isPublic, showMatchHistory });
  } catch (err: any) {
    console.error("Settings update error:", err);
    return NextResponse.json(
      { error: "Failed to update settings: " + err.message },
      { status: 500 }
    );
  }
}
