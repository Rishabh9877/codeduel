import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  PutCommand, GetCommand, DeleteCommand, ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";
import { getChallengeById, getRandomChallenge } from "@/lib/challenges";
import type { Challenge } from "@/lib/challenges";
import { v4 as uuidv4 } from "uuid";

const MATCH_DURATION_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  // 1 — Auth
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const username = session.user.name ?? "anonymous";

  let requestedChallengeId: string | undefined = undefined;
  let requestedTrack: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS' | undefined = undefined;
  try {
    const body = await req.json();
    requestedChallengeId = body.challengeId;
    requestedTrack = body.track;
  } catch (err) { }

  // 2 — Get current ELO
  const userItem = await dynamo.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    })
  );
  const myElo: number = userItem.Item?.elo ?? 1200;

  // 3 — Guard: already in a live (non-expired) match?
  const activeMatchScan = await dynamo.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression:
        "SK = :sk AND #s = :active AND (player1.userId = :uid OR player2.userId = :uid)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":sk": "META",
        ":active": "active",
        ":uid": userId,
      },
    })
  );
  const nowMs = Date.now();
  const validActive = (activeMatchScan.Items ?? []).filter(
    (item) => (item.startedAt ?? 0) + MATCH_DURATION_MS > nowMs
  );
  if (validActive.length > 0) {
    return NextResponse.json(
      { error: "Already in an active match", matchId: validActive[0].matchId },
      { status: 409 }
    );
  }

  // 4 — Check if already in queue (don't exit — just track it).
  const existingQueue = await dynamo.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `QUEUE#${userId}`, SK: "WAITING" },
    })
  );
  const alreadyInQueue = !!existingQueue.Item;
  const queuedAt = existingQueue.Item?.queuedAt ?? nowMs;
  const waitDurationMs = nowMs - queuedAt;

  const url = new URL(req.url);
  const isDemo = url.searchParams.get("demo") === "true";

  // Fallback to Mock Bot: if ?demo=true or queued >= 10 seconds
  if (isDemo || waitDurationMs >= 10000) {
    const challenge = requestedChallengeId
      ? getChallengeById(requestedChallengeId) ?? getRandomChallenge(requestedTrack)
      : getRandomChallenge(requestedTrack);

    const matchId = uuidv4();
    const botId = "bot_sentinel_ai";
    const botElo = Math.max(1050, myElo + 25);
    const ttl = Math.floor(nowMs / 1000) + 7200;

    await dynamo.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `MATCH#${matchId}`,
          SK: "META",
          matchId,
          status: "active",
          challengeId: challenge.id,
          track: challenge.track,
          startedAt: nowMs,
          finishedAt: null,
          winnerId: null,
          endedBy: null,
          isBotMatch: true,
          player1: {
            userId,
            username,
            avatar: session.user.image ?? null,
            elo: myElo,
            submitted: false,
            passed: false,
            testsPassed: 0,
            lastPingAt: nowMs,
          },
          player2: {
            userId: botId,
            username: "CodeSentinel AI [BOT]",
            avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=sentinel",
            elo: botElo,
            submitted: false,
            passed: false,
            testsPassed: 0,
            isBot: true,
            lastPingAt: nowMs,
          },
          ttl,
        },
      })
    );

    if (alreadyInQueue) {
      await dynamo.send(
        new DeleteCommand({ TableName: TABLE, Key: { PK: `QUEUE#${userId}`, SK: "WAITING" } })
      ).catch(() => {});
    }

    return NextResponse.json({ matchId, status: "matched", isBot: true });
  }

  // 5 — Scan queue for eligible opponents (non-expired, within ±200 ELO)
  const nowSec = Math.floor(Date.now() / 1000);

  const queueScan = await dynamo.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression:
        "begins_with(PK, :prefix) AND SK = :sk AND userId <> :me AND #ttl > :now",
      ExpressionAttributeNames: { "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":prefix": "QUEUE#",
        ":sk": "WAITING",
        ":me": userId,
        ":now": nowSec,
      },
    })
  );

  const nowMsCurrent = Date.now();
  const eligible = (queueScan.Items ?? []).filter(
    (item) => {
      const opponentWaitTime = nowMsCurrent - (item.queuedAt ?? nowMsCurrent);
      let allowedDiff = 200;
      if (opponentWaitTime > 60000) allowedDiff = 800;
      else if (opponentWaitTime >= 30000) allowedDiff = 400;

      // Track compatibility: both must want same track or at least one is flexible
      const trackMatch = !requestedTrack || !item.requestedTrack ||
        item.requestedTrack === requestedTrack;

      return Math.abs((item.elo ?? 1200) - myElo) <= allowedDiff && trackMatch;
    }
  );

  // 6a — Opponent found: atomically claim them then create the match
  for (const opponent of eligible) {
    try {
      await dynamo.send(
        new DeleteCommand({
          TableName: TABLE,
          Key: { PK: `QUEUE#${opponent.userId}`, SK: "WAITING" },
          ConditionExpression: "attribute_exists(PK)",
        })
      );

      // Also remove ourselves from the queue if we were in it
      if (alreadyInQueue) {
        await dynamo.send(
          new DeleteCommand({
            TableName: TABLE,
            Key: { PK: `QUEUE#${userId}`, SK: "WAITING" },
          })
        ).catch(() => { });
      }

      const matchId = uuidv4();

      // Resolve challenge: prefer explicit ID, then track preference, then fully random
      const finalChallengeId = requestedChallengeId || opponent.requestedChallengeId;
      const finalTrack = requestedTrack || opponent.requestedTrack;

      let challenge: Challenge;
      if (finalChallengeId) {
        challenge = getChallengeById(finalChallengeId) ?? getRandomChallenge(finalTrack);
      } else {
        challenge = getRandomChallenge(finalTrack);
      }

      const now = Date.now();
      const ttl = Math.floor(now / 1000) + 3600;

      await dynamo.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: `MATCH#${matchId}`,
            SK: "META",
            matchId,
            challengeId: challenge.id,
            track: challenge.track,
            status: "active",
            startedAt: now,
            finishedAt: null,
            winnerId: null,
            endedBy: null,
            player1: {
              userId,
              username,
              elo: myElo,
              hintsUsed: 0,
              submitted: false,
              passed: false,
              testsPassed: 0,
            },
            player2: {
              userId: opponent.userId,
              username: opponent.username,
              elo: opponent.elo ?? 1200,
              hintsUsed: 0,
              submitted: false,
              passed: false,
              testsPassed: 0,
            },
            ttl,
          },
        })
      );

      return NextResponse.json({ matchId, status: "matched" });

    } catch (err: any) {
      if (err instanceof ConditionalCheckFailedException) {
        continue; // Opponent already claimed — try next
      }
      throw err;
    }
  }

  // 6b — No opponent: add/refresh own queue entry
  const ttl = Math.floor(Date.now() / 1000) + 300;

  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `QUEUE#${userId}`,
        SK: "WAITING",
        userId,
        username,
        elo: myElo,
        queuedAt: Date.now(),
        ttl,
        requestedChallengeId,
        requestedTrack,
      },
    })
  );

  return NextResponse.json({ status: "queued" });
}
