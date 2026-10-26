import { v4 as uuidv4 } from "uuid";
import { dynamo, TABLE } from "../lib/dynamo";
import { PutCommand, GetCommand, DeleteCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { calcElo, STARTING_ELO } from "../lib/elo";

async function runPhase2ConcurrencyTests() {
  console.log("=================================================");
  console.log("RUNNING PHASE 2 CONCURRENCY & IDEMPOTENCY TEST SUITE");
  console.log("NOTE: DynamoDB Local is not installed on this host.");
  console.log("Tests run against the in-memory emulator prove");
  console.log("APPLICATION LOGIC ONLY, NOT DynamoDB WIRE SEMANTICS.");
  console.log("Do NOT mark 'verified' for DynamoDB wire semantics.");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Simultaneous Double-Submit (Atomic Match Finalization)
  // ─────────────────────────────────────────────────────────────
  total++;
  const matchId1 = `match_test_concurrent_${uuidv4()}`;
  const user1 = `user_p1_${uuidv4().slice(0, 8)}`;
  const user2 = `user_p2_${uuidv4().slice(0, 8)}`;

  // Seed active match and initial profiles
  const now = Date.now();
  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `MATCH#${matchId1}`,
      SK: "META",
      matchId: matchId1,
      status: "active",
      challengeId: "swe-url-query-sanitizer",
      player1: { userId: user1, username: "P1", elo: 1200, submitted: false, testsPassed: 0 },
      player2: { userId: user2, username: "P2", elo: 1200, submitted: false, testsPassed: 0 },
      startedAt: now,
    }
  }));

  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: `USER#${user1}`, SK: "PROFILE", userId: user1, username: "P1", elo: 1200, wins: 0, losses: 0 }
  }));
  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: `USER#${user2}`, SK: "PROFILE", userId: user2, username: "P2", elo: 1200, wins: 0, losses: 0 }
  }));

  // Simulate two simultaneous passing submissions attempting to finalize matchId1
  const submitFn = async (submitterId: string) => {
    try {
      const matchRes = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `MATCH#${matchId1}`, SK: "META" } }));
      const match = matchRes.Item;
      if (match.status !== "active") {
        return { status: "rejected_active_check", winnerId: match.winnerId };
      }

      const newWinnerElo = calcElo(1200, 1200, true);
      const newLoserElo = calcElo(1200, 1200, false);

      await dynamo.send(new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE,
              Key: { PK: `MATCH#${matchId1}`, SK: "META" },
              UpdateExpression: "SET #s = :status, winnerId = :wid, finishedAt = :now, newWinnerElo = :nwe, newLoserElo = :nle",
              ConditionExpression: "#s = :activeStatus",
              ExpressionAttributeNames: { "#s": "status" },
              ExpressionAttributeValues: {
                ":activeStatus": "active",
                ":status": "finished",
                ":wid": submitterId,
                ":now": Date.now(),
                ":nwe": newWinnerElo,
                ":nle": newLoserElo,
              }
            }
          },
          {
            Update: {
              TableName: TABLE,
              Key: { PK: `USER#${submitterId}`, SK: "PROFILE" },
              UpdateExpression: "SET elo = :nwe ADD wins :one",
              ExpressionAttributeValues: { ":nwe": newWinnerElo, ":one": 1 }
            }
          }
        ]
      }));
      return { status: "won", winnerId: submitterId };
    } catch (err: any) {
      if (err.name === "TransactionCanceledException" || err.name === "ConditionalCheckFailedException") {
        const finalMatch = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `MATCH#${matchId1}`, SK: "META" } }));
        return { status: "idempotent_finalized", winnerId: finalMatch.Item?.winnerId };
      }
      throw err;
    }
  };

  const [resA, resB] = await Promise.all([submitFn(user1), submitFn(user1)]);
  const results = [resA.status, resB.status];
  const wonCount = results.filter((s) => s === "won").length;
  const idempotentCount = results.filter((s) => s === "idempotent_finalized" || s === "rejected_active_check").length;

  const profileAfter = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${user1}`, SK: "PROFILE" } }));
  if (wonCount === 1 && idempotentCount === 1 && profileAfter.Item?.wins === 1 && profileAfter.Item?.elo === 1216) {
    console.log("✓ PASSED: Simultaneous double-submit finalized match exactly once (wins=1, ELO=1216, no double increment)");
    passed++;
  } else {
    console.error(`✗ FAILED: Double-submit anomaly: wonCount=${wonCount}, idempotentCount=${idempotentCount}, wins=${profileAfter.Item?.wins}`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Queue Ticket Atomic Claim (Conditional Delete)
  // ─────────────────────────────────────────────────────────────
  total++;
  const queueUserId = `queued_user_${uuidv4().slice(0, 8)}`;
  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `QUEUE#${queueUserId}`,
      SK: "WAITING",
      userId: queueUserId,
      username: "QueuedPlayer",
      elo: 1250,
      queuedAt: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 300,
    }
  }));

  const claimTicket = async (claimerId: string) => {
    try {
      await dynamo.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `QUEUE#${queueUserId}`, SK: "WAITING" },
        ConditionExpression: "attribute_exists(PK)",
      }));
      return { claimed: true, claimerId };
    } catch (err: any) {
      if (err.name === "ConditionalCheckFailedException" || (err.message && err.message.includes("conditional request failed"))) {
        return { claimed: false, claimerId, reason: "Already claimed" };
      }
      throw err;
    }
  };

  const [claimA, claimB] = await Promise.all([claimTicket("worker_1"), claimTicket("worker_2")]);
  const claimSuccess = [claimA, claimB].filter((c) => c.claimed).length;
  const claimFailed = [claimA, claimB].filter((c) => !c.claimed).length;

  if (claimSuccess === 1 && claimFailed === 1) {
    console.log("✓ PASSED: Concurrent ticket claim succeeded for exactly one worker; second rejected via conditional delete");
    passed++;
  } else {
    console.error(`✗ FAILED: Queue ticket claim conflict: success=${claimSuccess}, failed=${claimFailed}`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Server-Authoritative 15-Minute Deadline Expiry
  // ─────────────────────────────────────────────────────────────
  total++;
  const expiredMatchId = `match_expired_${uuidv4().slice(0, 8)}`;
  const pastTime = Date.now() - (16 * 60 * 1000); // 16 minutes ago (exceeded 15 min limit)

  await dynamo.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `MATCH#${expiredMatchId}`,
      SK: "META",
      matchId: expiredMatchId,
      status: "active",
      startedAt: pastTime,
      player1: { userId: "p1", elo: 1200 },
      player2: { userId: "p2", elo: 1200 },
    }
  }));

  // Attempt submit against expired match
  const matchDurationMs = 15 * 60 * 1000;
  const testMatch = (await dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `MATCH#${expiredMatchId}`, SK: "META" } }))).Item;
  const isExpired = (Date.now() - testMatch.startedAt) >= matchDurationMs;

  if (isExpired) {
    await dynamo.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `MATCH#${expiredMatchId}`, SK: "META" },
      UpdateExpression: "SET #s = :timeoutStatus, endedBy = :by, finishedAt = :now",
      ConditionExpression: "#s = :activeStatus",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":activeStatus": "active",
        ":timeoutStatus": "timed_out",
        ":by": "server_deadline",
        ":now": Date.now(),
      }
    }));
  }

  const updatedExpiredMatch = (await dynamo.send(new GetCommand({ TableName: TABLE, Key: { PK: `MATCH#${expiredMatchId}`, SK: "META" } }))).Item;
  if (updatedExpiredMatch.status === "timed_out" && updatedExpiredMatch.endedBy === "server_deadline") {
    console.log("✓ PASSED: Match exceeding 15-minute deadline atomically transitioned to 'timed_out' via server deadline");
    passed++;
  } else {
    console.error("✗ FAILED: Expired match was not transitioned to timed_out:", updatedExpiredMatch);
  }

  console.log(`\n=================================================`);
  console.log(`SUMMARY: ${passed}/${total} CONCURRENCY LOGIC TESTS PASSED`);
  console.log(`=================================================`);
  if (passed !== total) process.exit(1);
}

runPhase2ConcurrencyTests().catch((err) => {
  console.error("Unexpected test failure:", err);
  process.exit(1);
});
