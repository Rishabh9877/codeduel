import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  PutCommand, GetCommand, DeleteCommand, ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { dynamo, TABLE } from "@/lib/dynamo";
import { getChallengeById, getRandomChallenge } from "@/lib/challenges";
import { v4 as uuidv4 } from "uuid";

const MATCH_DURATION_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  // 1 — Auth
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ((session.user as any).id || (session.user as any).sub) as string;
  const username = session.user.name ?? "anonymous";

  let requestedChallengeId: string | undefined = undefined;
  let requestedTrack: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS' | undefined = undefined;
  let forceDemo = false;
  let clientQueuedAt: number | undefined = undefined;

  try {
    const body = await req.json();
    requestedChallengeId = body.challengeId;
    requestedTrack = body.track;
    forceDemo = body.demo === true;
    clientQueuedAt = body.queuedAt;
  } catch (err) {}

  const url = new URL(req.url);
  if (url.searchParams.get("demo") === "true") {
    forceDemo = true;
  }

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
      { status: "matched", matchId: validActive[0].matchId },
      { status: 200 }
    );
  }

  // 4 — Check existing queue item
  const existingQueue = await dynamo.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `QUEUE#${userId}`, SK: "WAITING" },
    })
  );

  const initialQueuedAt = existingQueue.Item?.queuedAt ?? clientQueuedAt ?? nowMs;
  const waitDurationMs = nowMs - initialQueuedAt;

  // 5 — Fallback to Mock Bot: if ?demo=true or queued >= 10 seconds
  if (forceDemo || waitDurationMs >= 10000) {
    const challenge = requestedChallengeId
      ? getChallengeById(requestedChallengeId) ?? getRandomChallenge(requestedTrack)
      : getRandomChallenge(requestedTrack);

    const matchId = uuidv4();
    const botId = "bot_sentinel_ai";
    const botElo = Math.max(1050, myElo + Math.floor(Math.random() * 40 - 20));

    const botSlot = {
      userId: botId,
      username: "CodeSentinel AI [BOT]",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=sentinel",
      elo: botElo,
      submitted: false,
      passed: false,
      testsPassed: 0,
      isBot: true,
      lastPingAt: nowMs,
    };

    const playerSlot = {
      userId,
      username,
      avatar: session.user.image ?? null,
      elo: myElo,
      submitted: false,
      passed: false,
      testsPassed: 0,
      lastPingAt: nowMs,
    };

    const matchItem = {
      PK: `MATCH#${matchId}`,
      SK: "META",
      matchId,
      status: "active",
      challengeId: challenge.id,
      track: challenge.track,
      player1: playerSlot,
      player2: botSlot,
      startedAt: nowMs,
      finishedAt: null,
      winnerId: null,
      endedBy: null,
      isBotMatch: true,
      ttl: Math.floor(nowMs / 1000) + 7200,
    };

    await dynamo.send(new PutCommand({ TableName: TABLE, Item: matchItem }));

    // Clean up queue waiting item
    await dynamo.send(
      new DeleteCommand({ TableName: TABLE, Key: { PK: `QUEUE#${userId}`, SK: "WAITING" } })
    ).catch(() => {});

    console.log(`[QUEUE] Match against Mock Bot created: ${matchId} for user ${userId} (waitDuration=${waitDurationMs}ms, demo=${forceDemo})`);
    return NextResponse.json({ status: "matched", matchId, isBot: true });
  }

  // 6 — Scan queue for human opponents
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

  const eligible = (queueScan.Items ?? []).filter((item) => {
    // Check track compatibility if specified
    if (requestedTrack && item.track && item.track !== requestedTrack) return false;
    const opponentWaitTime = nowMs - (item.queuedAt ?? nowMs);
    let allowedDiff = 200;
    if (opponentWaitTime > 60000) allowedDiff = 800;
    else if (opponentWaitTime >= 30000) allowedDiff = 400;
    return Math.abs(item.elo - myElo) <= allowedDiff;
  });

  if (eligible.length > 0) {
    const opponent = eligible[Math.floor(Math.random() * eligible.length)];

    // Atomically claim opponent
    try {
      await dynamo.send(
        new DeleteCommand({
          TableName: TABLE,
          Key: { PK: `QUEUE#${opponent.userId}`, SK: "WAITING" },
          ConditionExpression: "attribute_exists(PK)",
        })
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        // Someone else claimed opponent, re-queue self
        await enqueueSelf(userId, username, myElo, requestedTrack, initialQueuedAt);
        return NextResponse.json({ status: "waiting", queuedAt: initialQueuedAt, waitTimeMs: waitDurationMs });
      }
      throw err;
    }

    // Clean up self from queue if present
    await dynamo.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `QUEUE#${userId}`, SK: "WAITING" },
      })
    ).catch(() => {});

    // Create Match
    const challengeTrack = requestedTrack || opponent.track || (Math.random() > 0.5 ? 'PRODUCTION_SWE' : 'EMBEDDED_SYSTEMS');
    const challenge = requestedChallengeId
      ? getChallengeById(requestedChallengeId) ?? getRandomChallenge(challengeTrack)
      : getRandomChallenge(challengeTrack);

    const matchId = uuidv4();
    const matchItem = {
      PK: `MATCH#${matchId}`,
      SK: "META",
      matchId,
      status: "active",
      challengeId: challenge.id,
      track: challenge.track,
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
        userId: opponent.userId,
        username: opponent.username,
        avatar: opponent.avatar ?? null,
        elo: opponent.elo,
        submitted: false,
        passed: false,
        testsPassed: 0,
        lastPingAt: nowMs,
      },
      startedAt: nowMs,
      finishedAt: null,
      winnerId: null,
      endedBy: null,
      ttl: Math.floor(nowMs / 1000) + 7200,
    };

    await dynamo.send(new PutCommand({ TableName: TABLE, Item: matchItem }));
    console.log(`[QUEUE] Human 1v1 match created: ${matchId}`);
    return NextResponse.json({ status: "matched", matchId });
  }

  // 7 — No opponent found yet: write or update self in queue
  await enqueueSelf(userId, username, myElo, requestedTrack, initialQueuedAt);
  return NextResponse.json({
    status: "waiting",
    queuedAt: initialQueuedAt,
    waitTimeMs: waitDurationMs,
  });
}

// GET support for polling queue
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ((session.user as any).id || (session.user as any).sub) as string;

  // Scan for active match
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE,
      FilterExpression:
        "SK = :sk AND (player1.userId = :uid OR player2.userId = :uid) AND #s = :active",
      ExpressionAttributeValues: {
        ":sk": "META",
        ":uid": userId,
        ":active": "active",
      },
      ExpressionAttributeNames: {
        "#s": "status",
      },
    })
  );

  if (result.Items && result.Items.length > 0) {
    return NextResponse.json({
      status: "matched",
      matchId: result.Items[0].matchId,
    });
  }

  // Check queue waiting time
  const existingQueue = await dynamo.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `QUEUE#${userId}`, SK: "WAITING" },
    })
  );

  const queuedAt = existingQueue.Item?.queuedAt ?? Date.now();
  const waitDurationMs = Date.now() - queuedAt;

  const url = new URL(req.url);
  const isDemo = url.searchParams.get("demo") === "true";

  // If in demo mode or waited >= 10s, auto-trigger match with bot!
  if (isDemo || waitDurationMs >= 10000) {
    // Call POST handler internally with demo=true
    return POST(new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo: true, queuedAt }),
    }));
  }

  return NextResponse.json({
    status: "waiting",
    queuedAt,
    waitTimeMs: waitDurationMs,
  });
}

async function enqueueSelf(
  userId: string,
  username: string,
  elo: number,
  track?: string,
  queuedAt?: number
) {
  const now = Date.now();
  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `QUEUE#${userId}`,
        SK: "WAITING",
        userId,
        username,
        elo,
        track: track ?? "PRODUCTION_SWE",
        queuedAt: queuedAt ?? now,
        ttl: Math.floor(now / 1000) + 300,
      },
    })
  );
}
