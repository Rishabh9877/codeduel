import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";
import { calcElo } from "@/lib/elo";

/**
 * Public HTTP POST Gateway for Match Forfeits / Rage-Quits.
 * Path: /api/match/forfeit
 * Triggered when a player voluntarily clicks "Leave Match" or disconnects.
 */
export async function POST(req: Request) {
  try {
    // 1 — AUTHENTICATION CHECK
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = (session.user as any).id as string;
    const { matchId } = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: "matchId is required" }, { status: 400 });
    }

    // 2 — FETCH MATCH STATE
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

    // 3 — STATE VALIDATION
    if (match.status !== "active") {
      return NextResponse.json({ error: "Conflict", message: "Match is already finalized." }, { status: 409 });
    }

    // 4 — VERIFY THE LEAVER IS ACTUALLY IN THIS MATCH
    const isPlayer1 = match.player1.userId === currentUserId;
    const isPlayer2 = match.player2.userId === currentUserId;
    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json({ error: "Forbidden", message: "You are not a participant in this match." }, { status: 403 });
    }

    // 5 — CHOOSE WINNER AND LOSER BASED ON WHO FORFEITED
    const loserObj = isPlayer1 ? match.player1 : match.player2;
    const winnerObj = isPlayer1 ? match.player2 : match.player1;

    const winnerId = winnerObj.userId;
    const loserId = loserObj.userId;

    // Fetch the live profile ELOs instead of relying on the old match snapshot
    const [winnerRes, loserRes] = await Promise.all([
      dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${winnerId}`, SK: "PROFILE" } })),
      dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${loserId}`, SK: "PROFILE" } }))
    ]);

    // ── 90-Second Remake (No Ban) ──
    const forfeitTime = Date.now();
    const elapsedSeconds = (forfeitTime - match.startedAt) / 1000;

    if (elapsedSeconds <= 90) {
      const transactItems: any[] = [
        {
          Update: {
            TableName: TABLE,
            Key: { PK: `MATCH#${matchId}`, SK: "META" },
            UpdateExpression: "SET #s = :status, finishedAt = :now, endedBy = :by",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
              ":status": "cancelled",
              ":now": forfeitTime,
              ":by": "early_forfeit"
            }
          }
        }
      ];

      await dynamo.send(
        new TransactWriteCommand({
          TransactItems: transactItems
        })
      );

      const finalizedMatch = {
        ...match,
        status: "cancelled",
        finishedAt: forfeitTime,
        endedBy: "early_forfeit"
      };

      return NextResponse.json({ status: "cancelled", match: finalizedMatch }, { status: 200 });
    }

    const liveWinnerElo = winnerRes.Item?.elo ?? 1200;
    const liveLoserElo = loserRes.Item?.elo ?? 1200;

    const newWinnerElo = calcElo(liveWinnerElo, liveLoserElo, true);
    const newLoserElo = calcElo(liveLoserElo, liveWinnerElo, false);

    const now = Date.now();

    // 6 — EXECUTE ATOMIC TRANSACTION WITH OPTIMISTIC LOCKING
    await dynamo.send(
      new TransactWriteCommand({
        TransactItems: [
          // Update Match Status to "forfeited"
          {
            Update: {
              TableName: TABLE,
              Key: { PK: `MATCH#${matchId}`, SK: "META" },
              UpdateExpression: "SET #s = :status, winnerId = :wid, finishedAt = :now, endedBy = :by",
              ExpressionAttributeNames: { "#s": "status" },
              ExpressionAttributeValues: {
                ":status": "forfeited",
                ":wid": winnerId,
                ":now": now,
                ":by": "forfeit"
              }
            }
          },

          // Update Winner Profile (with Concurrency Protection)
          {
            Update: {
              TableName: TABLE,
              Key: { PK: `USER#${winnerId}`, SK: "PROFILE" },
              UpdateExpression: "SET elo = :newElo ADD wins :one",
              ConditionExpression: "elo = :liveElo",
              ExpressionAttributeValues: {
                ":newElo": newWinnerElo,
                ":liveElo": liveWinnerElo,
                ":one": 1
              }
            }
          },

          // Update Winner Leaderboard Entry
          {
            Put: {
              TableName: TABLE,
              Item: {
                PK: `USER#${winnerId}`,
                SK: "LEADERBOARD",
                GSI1PK: "LEADERBOARD#GLOBAL",
                GSI1SK: newWinnerElo,
                userId: winnerId,
                username: winnerObj.username
              }
            }
          },

          // Update Loser Profile (with Concurrency Protection)
          {
            Update: {
              TableName: TABLE,
              Key: { PK: `USER#${loserId}`, SK: "PROFILE" },
              UpdateExpression: "SET elo = :newElo ADD losses :one",
              ConditionExpression: "elo = :liveElo",
              ExpressionAttributeValues: {
                ":newElo": newLoserElo,
                ":liveElo": liveLoserElo,
                ":one": 1
              }
            }
          },

          // Update Loser Leaderboard Entry
          {
            Put: {
              TableName: TABLE,
              Item: {
                PK: `USER#${loserId}`,
                SK: "LEADERBOARD",
                GSI1PK: "LEADERBOARD#GLOBAL",
                GSI1SK: newLoserElo,
                userId: loserId,
                username: loserObj.username
              }
            }
          }
        ]
      })
    );

    const finalizedMatch = {
      ...match,
      status: "forfeited",
      winnerId: winnerId,
      finishedAt: now,
      endedBy: "forfeit",
      player1: { ...match.player1, elo: isPlayer1 ? newLoserElo : newWinnerElo },
      player2: { ...match.player2, elo: isPlayer1 ? newWinnerElo : newLoserElo }
    };

    return NextResponse.json({
      status: "forfeited",
      leaverId: loserId,
      winnerId: winnerId,
      match: finalizedMatch,
      data: {
        winner: { id: winnerId, newElo: newWinnerElo },
        loser: { id: loserId, newElo: newLoserElo }
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("[API Match Forfeit Critical Error]:", error);

    if (error.name === "TransactionCanceledException" && error.message.includes("ConditionalCheckFailed")) {
      return NextResponse.json(
        { error: "CONCURRENCY_CONFLICT", message: "Profiles were updated out-of-band mid-flight. Forfeit processed late." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
