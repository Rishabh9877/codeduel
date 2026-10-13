import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

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
