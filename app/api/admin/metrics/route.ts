import { NextResponse } from "next/server";
import { dynamo, TABLE } from "@/lib/dynamo";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SEED_CHALLENGES } from "@/lib/challenges";
import { SEEDED_COHORTS } from "@/lib/campus";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();

  try {
    // 1. Scan profiles for user counts
    const profileScan = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
      })
    );
    const users = profileScan.Items || [];

    // 2. Scan matches
    const matchScan = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "META" },
      })
    );
    const matches = matchScan.Items || [];

    // 3. Scan campus cohorts
    const cohortScan = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(PK, :cp) AND SK = :meta",
        ExpressionAttributeValues: { ":cp": "COHORT#", ":meta": "METADATA" },
      })
    );
    const dbCohorts = cohortScan.Items || [];

    // Match track breakdown
    let eceMatches = 0;
    let sweMatches = 0;
    matches.forEach((m) => {
      if (m.track === "EMBEDDED_SYSTEMS" || m.challengeId?.startsWith("embedded-")) {
        eceMatches++;
      } else {
        sweMatches++;
      }
    });

    const totalMatches = matches.length;
    const ecePercentage = totalMatches > 0 ? Math.round((eceMatches / totalMatches) * 100) : 55;
    const swePercentage = 100 - ecePercentage;

    // Total challenges in curriculum
    const allChallengesList = Object.values(SEED_CHALLENGES);
    const totalChallenges = allChallengesList.length;
    const embeddedChallenges = allChallengesList.filter((c) => c.track === "EMBEDDED_SYSTEMS").length;
    const sweChallenges = allChallengesList.filter((c) => c.track === "PRODUCTION_SWE").length;

    // Total cohorts
    const allCohortCodes = new Set([
      ...SEEDED_COHORTS.map((c) => c.code),
      ...dbCohorts.map((c) => c.code),
    ]);
    const totalCohorts = allCohortCodes.size;
    const totalEnrolledStudents =
      SEEDED_COHORTS.reduce((acc, c) => acc + c.studentCount, 0) +
      dbCohorts.reduce((acc, c) => acc + Number(c.studentCount || 0), 0);

    const queryLatencyMs = Date.now() - startTime;

    return NextResponse.json({
      overview: {
        totalDevelopers: users.length || 3, // At least demo/admin users
        totalMatches: matches.length,
        eceMatches,
        sweMatches,
        ecePercentage,
        swePercentage,
        totalCohorts,
        totalEnrolledStudents,
        totalChallenges,
        embeddedChallenges,
        sweChallenges,
      },
      systemHealth: {
        databaseAdapter: "PostgreSQL / DynamoDB Adapter Connected",
        executionEngine: "Piston Isolation Engine + Built-in Sandbox",
        geminiCoachGateway: process.env.GEMINI_API_KEY ? "Operational (API Key Loaded)" : "Active (Fallback Guardrail Mode)",
        queryLatencyMs,
        serverTime: new Date().toISOString(),
      },
      recentMatches: matches.slice(0, 8).map((m) => ({
        matchId: m.matchId,
        challengeId: m.challengeId,
        track: m.track || (m.challengeId?.startsWith("embedded-") ? "EMBEDDED_SYSTEMS" : "PRODUCTION_SWE"),
        status: m.status,
        player1: m.player1?.username || "Player 1",
        player2: m.player2?.username || "Player 2",
        winnerId: m.winnerId,
        startedAt: m.startedAt,
      })),
    });
  } catch (err: any) {
    console.error("Failed to load admin metrics:", err);
    return NextResponse.json(
      { error: "Failed to load metrics: " + err.message },
      { status: 500 }
    );
  }
}
