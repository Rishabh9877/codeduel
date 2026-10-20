import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SEEDED_COHORTS } from "@/lib/campus";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { code, title, challengeId, dueDate, track, difficulty, points } = body;

    if (!code || !title || !challengeId) {
      return NextResponse.json(
        { error: "Code, assignment title, and challenge ID are required." },
        { status: 400 }
      );
    }

    const cleanCode = code.toUpperCase().trim();
    const userId = ((session.user as any).id || (session.user as any).sub) as string;

    // Verify course ownership
    const cohortRes = await dynamo.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `COHORT#${cleanCode}`, SK: "METADATA" },
      })
    );

    let cohortItem = cohortRes.Item;
    if (!cohortItem) {
      const seeded = SEEDED_COHORTS.find((c) => c.code === cleanCode);
      if (seeded) {
        cohortItem = {
          PK: `COHORT#${cleanCode}`,
          SK: "METADATA",
          code: seeded.code,
          title: seeded.title,
          department: seeded.department,
          institution: seeded.institution,
          instructorId: userId,
          instructorName: session.user.name || seeded.instructorName,
          description: seeded.description,
          createdAt: seeded.createdAt,
          studentCount: seeded.studentCount,
          assignmentsCount: seeded.assignmentsCount,
        };
        await dynamo.send(new PutCommand({ TableName: TABLE, Item: cohortItem }));
      } else {
        return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
      }
    }

    if (cohortItem.instructorId !== userId) {
      // Check if user is at least verified faculty or admin
      const profRes = await dynamo.send(
        new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: "PROFILE" } })
      );
      const callerRole = profRes.Item?.role || (session.user as any).role;
      if (callerRole !== "FACULTY" && callerRole !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: Only the verified course instructor or platform admin can create assignments for this cohort." },
          { status: 403 }
        );
      }
    }
    const assignmentId = `asg-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const assignment = {
      PK: `COHORT#${cleanCode}`,
      SK: `ASSIGNMENT#${assignmentId}`,
      assignmentId,
      title: title.trim(),
      challengeId: challengeId.trim(),
      dueDate: dueDate || "Due in 7 days",
      track: track || (challengeId.startsWith("embedded-") ? "EMBEDDED_SYSTEMS" : "PRODUCTION_SWE"),
      difficulty: difficulty || "Medium",
      points: Number(points) || 100,
      createdAt: now,
    };

    await dynamo.send(new PutCommand({ TableName: TABLE, Item: assignment }));

    // Increment assignmentCount on cohort metadata if exists
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `COHORT#${cleanCode}`, SK: "METADATA" },
          UpdateExpression: "ADD assignmentsCount :inc",
          ExpressionAttributeValues: { ":inc": 1 },
        })
      );
    } catch (e) {
      console.warn("Could not increment assignmentsCount:", e);
    }

    return NextResponse.json({ success: true, assignment });
  } catch (err: any) {
    console.error("Failed to create assignment:", err);
    return NextResponse.json(
      { error: "Failed to create assignment: " + err.message },
      { status: 500 }
    );
  }
}
