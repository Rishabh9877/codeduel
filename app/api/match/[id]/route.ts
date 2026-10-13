import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GetCommand, UpdateCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";
import { getChallengeById } from "@/lib/challenges";
import { calcElo } from "@/lib/elo";

export const dynamic = "force-dynamic";

const MATCH_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const { id: matchId } = await params;

  // Fetch match from DynamoDB
  const result = await dynamo.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `MATCH#${matchId}`, SK: "META" },
    })
  );

  if (!result.Item) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const match = result.Item;

  // Security: only players in this match can see it
  if (
    match.player1.userId !== userId &&
    match.player2.userId !== userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const myRole = match.player1.userId === userId ? "player1" : "player2";
  const opponentRole = myRole === "player1" ? "player2" : "player1";

  if (match.status === "active") {
    // ── Ghost Abandon Heartbeat ──
    // 1. Update my last ping
    const now = Date.now();
    await dynamo.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `MATCH#${matchId}`, SK: "META" },
      UpdateExpression: `SET ${myRole}.lastPingAt = :now`,
      ExpressionAttributeValues: { ":now": now }
    })).catch(() => {});

    // ── Simulated Mock Bot Progress ──
    const botRole = match.player1.isBot ? "player1" : match.player2.isBot ? "player2" : null;
    if (botRole && match.status === "active") {
      const challengeDef = getChallengeById(match.challengeId);
      const totalTests = challengeDef?.totalTests ?? 3;
      const elapsedMs = now - (match.startedAt ?? now);

      // Progressive simulation: tests pass sequentially over 40 seconds
      const simulatedPassed = Math.min(totalTests, Math.floor((elapsedMs / 40000) * totalTests));

      if (simulatedPassed > (match[botRole].testsPassed ?? 0)) {
        match[botRole].testsPassed = simulatedPassed;
        match[botRole].submitted = true;

        await dynamo.send(new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `MATCH#${matchId}`, SK: "META" },
          UpdateExpression: `SET ${botRole}.testsPassed = :tp, ${botRole}.submitted = :t, ${botRole}.lastPingAt = :now`,
          ExpressionAttributeValues: {
            ":tp": simulatedPassed,
            ":t": true,
            ":now": now,
          }
        })).catch(() => {});
      }

      // If 40 seconds elapsed, bot solves everything and wins
      if (elapsedMs >= 40000 && match.status === "active") {
        const botId = match[botRole].userId;
        const humanRole = botRole === "player1" ? "player2" : "player1";
        const humanId = match[humanRole].userId;

        match.status = "finished";
        match.winnerId = botId;
        match.finishedAt = now;
        match.endedBy = "bot_solve";
        match[botRole].passed = true;
        match[botRole].testsPassed = totalTests;

        // Fetch live human profile for accurate ELO calculation
        const humanProfileRes = await dynamo.send(new GetCommand({
          TableName: TABLE,
          Key: { PK: `USER#${humanId}`, SK: "PROFILE" }
        })).catch(() => ({ Item: null }));

        const liveHumanElo = Number(humanProfileRes.Item?.elo ?? match[humanRole].elo ?? 1200);
        const liveBotElo = Number(match[botRole].elo ?? 1200);

        const newBotElo = calcElo(liveBotElo, liveHumanElo, true);
        const newHumanElo = calcElo(liveHumanElo, liveBotElo, false);

        const humanWins = Number(humanProfileRes.Item?.wins ?? 0);
        const humanLosses = (Number(humanProfileRes.Item?.losses) || 0) + 1;

        match.newWinnerElo = newBotElo;
        match.newLoserElo = newHumanElo;
        match[humanRole].elo = newHumanElo;
        match[botRole].elo = newBotElo;

        await dynamo.send(new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: TABLE,
                Key: { PK: `MATCH#${matchId}`, SK: "META" },
                UpdateExpression: "SET #s = :fin, winnerId = :wid, finishedAt = :now, endedBy = :eb, " +
                                  `${botRole}.passed = :t, ${botRole}.testsPassed = :tt, newWinnerElo = :nwe, newLoserElo = :nle`,
                ConditionExpression: "#s = :act",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                  ":fin": "finished",
                  ":wid": botId,
                  ":now": now,
                  ":eb": "bot_solve",
                  ":t": true,
                  ":tt": totalTests,
                  ":act": "active",
                  ":nwe": newBotElo,
                  ":nle": newHumanElo,
                }
              }
            },
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${humanId}`,
                  SK: "PROFILE",
                  userId: humanId,
                  username: humanProfileRes.Item?.username ?? match[humanRole].username ?? "Developer",
                  email: humanProfileRes.Item?.email ?? null,
                  avatar: humanProfileRes.Item?.avatar ?? match[humanRole].avatar ?? null,
                  elo: newHumanElo,
                  wins: humanWins,
                  losses: humanLosses,
                  createdAt: humanProfileRes.Item?.createdAt ?? now,
                }
              }
            },
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${humanId}`,
                  SK: "LEADERBOARD",
                  GSI1PK: "LEADERBOARD#GLOBAL",
                  GSI1SK: newHumanElo,
                  userId: humanId,
                  username: humanProfileRes.Item?.username ?? match[humanRole].username ?? "Developer",
                  avatar: humanProfileRes.Item?.avatar ?? match[humanRole].avatar ?? null,
                  wins: humanWins,
                  losses: humanLosses,
                }
              }
            }
          ]
        })).catch((err) => {
          console.error("[Bot Solve Commit Error]:", err);
        });
      }
    }

    // 2. Check opponent's last ping (skip if opponent is bot)
    const opponent = match[opponentRole];
    const opponentLastPingAt = opponent.lastPingAt ?? match.startedAt;
    
    if (!opponent.isBot && now - opponentLastPingAt > 45000) {
      // Opponent disconnected!
      const winnerId = userId;
      const loserId = opponent.userId;

      // Fetch live profiles for accurate ELO calculation
      const [winnerRes, loserRes] = await Promise.all([
        dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${winnerId}`, SK: "PROFILE" } })),
        dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${loserId}`, SK: "PROFILE" } }))
      ]);

      const liveWinnerElo = winnerRes.Item?.elo ?? match[myRole].elo;
      const liveLoserElo  = loserRes.Item?.elo ?? opponent.elo;

      const newWinnerElo = calcElo(liveWinnerElo, liveLoserElo, true);
      const newLoserElo  = calcElo(liveLoserElo, liveWinnerElo, false);

      try {
        await dynamo.send(new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: TABLE,
                Key: { PK: `MATCH#${matchId}`, SK: "META" },
                UpdateExpression: "SET #s = :status, winnerId = :wid, finishedAt = :now, endedBy = :by",
                ConditionExpression: "#s = :active",
                ExpressionAttributeNames: { "#s": "status" },
                ExpressionAttributeValues: {
                  ":status": "forfeited",
                  ":wid": winnerId,
                  ":now": now,
                  ":by": "timeout_disconnect",
                  ":active": "active"
                }
              }
            },
            {
              Update: {
                TableName: TABLE,
                Key: { PK: `USER#${winnerId}`, SK: "PROFILE" },
                UpdateExpression: "SET elo = :elo ADD wins :one",
                ConditionExpression: "elo = :liveElo",
                ExpressionAttributeValues: { ":elo": newWinnerElo, ":liveElo": liveWinnerElo, ":one": 1 }
              }
            },
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${winnerId}`, SK: "LEADERBOARD", GSI1PK: "LEADERBOARD#GLOBAL", GSI1SK: newWinnerElo,
                  userId: winnerId, username: match[myRole].username
                }
              }
            },
            {
              Update: {
                TableName: TABLE,
                Key: { PK: `USER#${loserId}`, SK: "PROFILE" },
                UpdateExpression: "SET elo = :elo ADD losses :one",
                ConditionExpression: "elo = :liveElo",
                ExpressionAttributeValues: { ":elo": newLoserElo, ":liveElo": liveLoserElo, ":one": 1 }
              }
            },
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `USER#${loserId}`, SK: "LEADERBOARD", GSI1PK: "LEADERBOARD#GLOBAL", GSI1SK: newLoserElo,
                  userId: loserId, username: opponent.username
                }
              }
            }
          ]
        }));

        match.status = "forfeited";
        match.finishedAt = now;
        match.winnerId = winnerId;
        match.endedBy = "timeout_disconnect";
        match[myRole].elo = newWinnerElo;
        match[opponentRole].elo = newLoserElo;
      } catch (err) {
        // Condition check failed means someone else updated the match or ELO concurrently
      }
    }
  }

  // Attach challenge data
  const challenge = getChallengeById(match.challengeId);
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  return NextResponse.json({
    match: {
      matchId:    match.matchId,
      status:     match.status,
      startedAt:  match.startedAt,
      finishedAt: match.finishedAt ?? null,
      winnerId:   match.winnerId   ?? null,
      endedBy:    match.endedBy    ?? null,
      player1:    match.player1,
      player2:    match.player2,
      newWinnerElo: match.newWinnerElo ?? null,
      newLoserElo:  match.newLoserElo ?? null,
    },
    challenge: {
      id: challenge.id,
      track: challenge.track,
      language: challenge.language,
      title: challenge.title,
      repoContext: challenge.repoContext,
      ticketMarkdown: challenge.ticketMarkdown,
      files: challenge.files,
      entrypoint: challenge.entrypoint,
      totalTests: challenge.totalTests,
    },
    myRole,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
