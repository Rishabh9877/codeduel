import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GetCommand, UpdateCommand, PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";
import { getChallengeById } from "@/lib/challenges";
import { executeChallenge } from "@/lib/challengeExecutor";
import { calcElo } from "@/lib/elo";

export async function POST(req: Request) {
  try {
    // 1 — Auth
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = ((session.user as any).id || (session.user as any).sub) as string;
    const { matchId, files } = await req.json();

    // `files` is a Record<string, string> mapping filename → content
    // Only editable files should be submitted; readOnly files are sourced from
    // the challenge definition server-side.

    console.log(`[SUBMIT Step 1] Payload received — matchId=${matchId}, userId=${userId}, fileCount=${files ? Object.keys(files).length : 0}`);

    if (!matchId || !files || typeof files !== 'object') {
      return NextResponse.json({ error: "matchId and files are required" }, { status: 400 });
    }

    // 2 — Fetch match from DynamoDB
    const matchResult = await dynamo.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `MATCH#${matchId}`, SK: "META" },
      })
    );

    const match = matchResult.Item;
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // 3 — Validate player is in this match
    const isPlayer1 = match.player1.userId === userId;
    const isPlayer2 = match.player2.userId === userId;
    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4 — Match must still be active
    if (match.status !== "active") {
      return NextResponse.json({ error: "Match already finished" }, { status: 409 });
    }

    // 5 — Get challenge definition
    const challenge = getChallengeById(match.challengeId);
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // 6 — Execute via Piston using the multi-file challenge executor
    // SECURITY: Code is ONLY executed remotely via the Piston API (sandboxed containers).
    const execution = await executeChallenge(challenge, files);

    if (execution.status === 'execution_service_unavailable') {
      return NextResponse.json(
        {
          error: "EXECUTION_SERVICE_UNAVAILABLE",
          message: execution.stderr,
        },
        { status: 503 }
      );
    }

    console.log(`[SUBMIT Step 3] Tests evaluated — allPassed=${execution.allPassed}, passed=${execution.passed}/${execution.total}, runtimeMs=${execution.runtimeMs}, status=${execution.status}`);

    const myRole = isPlayer1 ? "player1" : "player2";
    const opponentRole = isPlayer1 ? "player2" : "player1";

    // 7 — Write submission record to DynamoDB
    const now = Date.now();
    const ttl = Math.floor(now / 1000) + 3600;

    // Serialize only the editable file content for the submission record
    const editableFiles: Record<string, string> = {};
    for (const f of challenge.files) {
      if (!f.readOnly && files[f.name]) {
        editableFiles[f.name] = files[f.name];
      }
    }

    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `MATCH#${matchId}`,
          SK: `SUB#${userId}#${now}`,
          matchId,
          userId,
          language: challenge.language,
          files: editableFiles,
          status: execution.status,
          testsPassed: execution.passed,
          testsTotal: execution.total,
          runtimeMs: execution.runtimeMs,
          stdout: execution.stdout?.substring(0, 2000) ?? null,
          stderr: execution.stderr?.substring(0, 2000) ?? null,
          testResults: execution.testResults,
          submittedAt: now,
          ttl,
        },
      })
    );

    // 8 — Update player's submission status on the match META item
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `MATCH#${matchId}`, SK: "META" },
        UpdateExpression: `SET ${myRole}.submitted = :t, ${myRole}.passed = :passed, ${myRole}.testsPassed = :tp`,
        ExpressionAttributeValues: {
          ":t": true,
          ":passed": execution.allPassed,
          ":tp": execution.passed,
        },
      })
    );

    // 9 — If all test cases passed: this player wins, end the match + update ELO
    if (execution.allPassed) {
      const winner = match[myRole];
      const loser = match[opponentRole];

      const [winnerProfileResult, loserProfileResult] = await Promise.all([
        dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${winner.userId}`, SK: "PROFILE" } })),
        dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${loser.userId}`, SK: "PROFILE" } }))
      ]);

      const liveWinnerElo = winnerProfileResult.Item?.elo ?? 1200;
      const liveLoserElo = loserProfileResult.Item?.elo ?? 1200;

      const newWinnerElo = calcElo(liveWinnerElo, liveLoserElo, true);
      const newLoserElo = calcElo(liveLoserElo, liveWinnerElo, false);

      const winnerWins = (Number(winnerProfileResult.Item?.wins) || 0) + 1;
      const winnerLosses = Number(winnerProfileResult.Item?.losses) || 0;
      const loserWins = Number(loserProfileResult.Item?.wins) || 0;
      const loserLosses = (Number(loserProfileResult.Item?.losses) || 0) + 1;

      console.log(`[SUBMIT Step 4] Committing match victory: winnerId=${winner.userId} (${liveWinnerElo} -> ${newWinnerElo}), loserId=${loser.userId} (${liveLoserElo} -> ${newLoserElo})`);

      await dynamo.send(
        new TransactWriteCommand({
          TransactItems: [
            // 1. Mark match finished
            {
              Update: {
                TableName: TABLE,
                Key: { PK: `MATCH#${matchId}`, SK: "META" },
                UpdateExpression:
                  "SET #s = :status, winnerId = :wid, finishedAt = :now, endedBy = :by, newWinnerElo = :nwe, newLoserElo = :nle",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                  ":status": "finished",
                  ":wid": userId,
                  ":now": now,
                  ":by": "submission",
                  ":nwe": newWinnerElo,
                  ":nle": newLoserElo,
                },
              },
            },

            // 2. Winner profile update
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${winner.userId}`,
                  SK: "PROFILE",
                  userId: winner.userId,
                  username: winner.username,
                  avatar: winner.avatar ?? null,
                  elo: newWinnerElo,
                  wins: winnerWins,
                  losses: winnerLosses,
                  createdAt: winnerProfileResult.Item?.createdAt ?? now,
                },
              },
            },

            // 3. Winner leaderboard entry
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${winner.userId}`,
                  SK: "LEADERBOARD",
                  GSI1PK: "LEADERBOARD#GLOBAL",
                  GSI1SK: newWinnerElo,
                  userId: winner.userId,
                  username: winner.username,
                  avatar: winner.avatar ?? null,
                  wins: winnerWins,
                  losses: winnerLosses,
                },
              },
            },

            // 4. Loser profile update
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${loser.userId}`,
                  SK: "PROFILE",
                  userId: loser.userId,
                  username: loser.username,
                  avatar: loser.avatar ?? null,
                  elo: newLoserElo,
                  wins: loserWins,
                  losses: loserLosses,
                  createdAt: loserProfileResult.Item?.createdAt ?? now,
                },
              },
            },

            // 5. Loser leaderboard entry
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${loser.userId}`,
                  SK: "LEADERBOARD",
                  GSI1PK: "LEADERBOARD#GLOBAL",
                  GSI1SK: newLoserElo,
                  userId: loser.userId,
                  username: loser.username,
                  avatar: loser.avatar ?? null,
                  wins: loserWins,
                  losses: loserLosses,
                },
              },
            },
          ],
        })
      );

      return NextResponse.json({
        result: "accepted",
        testsPassed: execution.passed,
        testsTotal: execution.total,
        runtimeMs: execution.runtimeMs,
        testResults: execution.testResults,
        stdout: execution.stdout?.substring(0, 2000) ?? null,
        stderr: execution.stderr?.substring(0, 2000) ?? null,
        matchOver: true,
        won: true,
        eloChange: newWinnerElo - liveWinnerElo,
        newElo: newWinnerElo,
      });
    }

    // 10 — Wrong answer: return feedback without ending the match
    return NextResponse.json({
      result: execution.status,
      testsPassed: execution.passed,
      testsTotal: execution.total,
      runtimeMs: execution.runtimeMs,
      testResults: execution.testResults,
      stdout: execution.stdout?.substring(0, 2000) ?? null,
      stderr: execution.stderr?.substring(0, 2000) ?? null,
      matchOver: false,
      won: false,
    });

  } catch (error: any) {
    console.error("[API Match Submit Critical Error]:", error);

    // Capture distributed runtime collisions when an out-of-band write breaks condition locks
    if (error.name === "TransactionCanceledException" && error.message.includes("ConditionalCheckFailed")) {
      return NextResponse.json(
        {
          result: "error",
          testsPassed: 0,
          testsTotal: 0,
          matchOver: false,
          won: false,
          error: "ELO desync detected. Your code was evaluated but the match state drifted. Please re-submit.",
          message: "CONCURRENCY_CONFLICT"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        result: "error",
        testsPassed: 0,
        testsTotal: 0,
        matchOver: false,
        won: false,
        error: error.message ?? "An unexpected system execution fault occurred.",
        message: "INTERNAL_SERVER_ERROR"
      },
      { status: 500 }
    );
  }
}
