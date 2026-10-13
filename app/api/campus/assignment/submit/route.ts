import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dynamo, TABLE } from "@/lib/dynamo";
import { PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ((session.user as any).id || (session.user as any).sub) as string;
    const body = await req.json();
    const { code, challengeId, assignmentId, timeTakenSeconds } = body;

    if (!code || (!challengeId && !assignmentId)) {
      return NextResponse.json({ error: "Cohort code and assignment identifier are required" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();
    let targetAssignmentId = assignmentId;

    // If only challengeId was passed, find corresponding assignment in this cohort
    if (!targetAssignmentId && challengeId) {
      const asgRes = await dynamo.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `COHORT#${cleanCode}`,
            ":skPrefix": "ASSIGNMENT#",
          },
        })
      );
      const match = (asgRes.Items || []).find((a) => a.challengeId === challengeId);
      if (match) targetAssignmentId = match.assignmentId;
      else targetAssignmentId = `asg-${challengeId}`;
    }

    const now = new Date().toISOString();

    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `COHORT#${cleanCode}`,
          SK: `SUBMISSION#${targetAssignmentId}#${userId}`,
          userId,
          username: session.user.name || "Student",
          assignmentId: targetAssignmentId,
          status: "PASSED",
          timeTakenSeconds: Number(timeTakenSeconds) || 180,
          passedAt: now,
        },
      })
    );

    // Update student's completed assignments count in this cohort
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `COHORT#${cleanCode}`, SK: `STUDENT#${userId}` },
          UpdateExpression: "ADD completedAssignmentsCount :inc",
          ExpressionAttributeValues: { ":inc": 1 },
        })
      );
    } catch (e) {
      console.warn("Could not increment student completedAssignmentsCount:", e);
    }

    return NextResponse.json({ success: true, assignmentId: targetAssignmentId });
  } catch (err: any) {
    console.error("Failed to submit assignment progress:", err);
    return NextResponse.json({ error: "Failed to submit assignment: " + err.message }, { status: 500 });
  }
}
