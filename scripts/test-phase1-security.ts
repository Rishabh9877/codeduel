// =============================================================================
// PHASE 1.6 SECURITY & AUTHORIZATION AUTOMATED TEST SUITE
// =============================================================================

import { dynamo, TABLE } from "../lib/dynamo";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { authOptions } from "../lib/auth";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

function extractCookies(res: Response): string[] {
  if (typeof (res.headers as any).getSetCookie === "function") {
    return (res.headers as any).getSetCookie();
  }
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

// Helper: Authenticates via the NextAuth credentials flow and returns the session cookie
async function loginGuest(guestId: string, username: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const csrfCookies = extractCookies(csrfRes);

  const params = new URLSearchParams({
    csrfToken,
    guestId,
    username,
    json: "true",
  });

  const cbRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies.map((c) => c.split(";")[0]).join("; "),
    },
    body: params.toString(),
  });

  const cbCookies = extractCookies(cbRes);
  const allCookies = [...csrfCookies, ...cbCookies];
  return allCookies.map((c) => c.split(";")[0]).join("; ");
}

async function runTests() {
  console.log("=================================================");
  console.log("PHASE 1.6 SECURITY & AUTHORIZATION TEST SUITE");
  console.log("Base URL:", BASE_URL);
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`✓ PASSED: ${desc}`);
      passedTests++;
    } else {
      console.error(`✗ FAILED: ${desc}`);
      process.exitCode = 1;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. OBTAIN REAL AUTHENTICATED SESSIONS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Authenticating Test Sessions via Credentials Flow ---");
  const studentCookie = await loginGuest("1", "Student_Alpha");
  assert(Boolean(studentCookie.includes("next-auth.session-token")), "Student session token acquired via credentials provider");

  const facultyCookie = await loginGuest("faculty", "Dr. Vikram Malhotra");
  assert(Boolean(facultyCookie.includes("next-auth.session-token")), "Demo faculty session token acquired via credentials provider");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AUTHENTICATED STUDENT ACCESS CONTROL (MUST BE 403 / 402)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Testing Authenticated Student Role Enforcements ---");

  // 2a. Student -> 403 on cohort roster
  const studentRosterRes = await fetch(`${BASE_URL}/api/campus/cohort/ECE-204-EMBEDDED?view=roster`, {
    headers: { Cookie: studentCookie },
  });
  const studentRosterBody = await studentRosterRes.json();
  console.log(`[HTTP ${studentRosterRes.status}] Student GET cohort roster ->`, studentRosterBody.error || studentRosterBody);
  assert(studentRosterRes.status === 403, `Authenticated student rejected from cohort roster with 403 (got ${studentRosterRes.status})`);

  // 2b. Student -> 403 on cohort gradebook
  const studentGradebookRes = await fetch(`${BASE_URL}/api/campus/cohort/ECE-204-EMBEDDED?view=gradebook`, {
    headers: { Cookie: studentCookie },
  });
  console.log(`[HTTP ${studentGradebookRes.status}] Student GET cohort gradebook`);
  assert(studentGradebookRes.status === 403, `Authenticated student rejected from cohort gradebook with 403 (got ${studentGradebookRes.status})`);

  // 2c. Student -> 403 on CSV export
  const studentCsvRes = await fetch(`${BASE_URL}/api/campus/cohort/ECE-204-EMBEDDED?view=csv`, {
    headers: { Cookie: studentCookie },
  });
  console.log(`[HTTP ${studentCsvRes.status}] Student GET cohort CSV export`);
  assert(studentCsvRes.status === 403, `Authenticated student rejected from CSV export with 403 (got ${studentCsvRes.status})`);

  // 2d. Student -> 403 on assignment creation
  const studentAsgRes = await fetch(`${BASE_URL}/api/campus/assignment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({
      code: "ECE-204-EMBEDDED",
      title: "Student Created Assignment",
      challengeId: "embedded-ring-buffer",
    }),
  });
  const studentAsgBody = await studentAsgRes.json();
  console.log(`[HTTP ${studentAsgRes.status}] Student POST assignment create ->`, studentAsgBody.error || studentAsgBody);
  assert(studentAsgRes.status === 403, `Authenticated student rejected from assignment create with 403 (got ${studentAsgRes.status})`);

  // 2e. Student POST user/settings role=ADMIN -> 403
  const studentAdminRes = await fetch(`${BASE_URL}/api/user/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  const studentAdminBody = await studentAdminRes.json();
  console.log(`[HTTP ${studentAdminRes.status}] Student POST user/settings { role: 'ADMIN' } ->`, studentAdminBody.error || studentAdminBody);
  assert(studentAdminRes.status === 403, `Authenticated student cannot elevate to ADMIN via user/settings (got ${studentAdminRes.status})`);

  // 2f. Student POST subscription tier=PRO -> 402 Payment Required
  const studentProRes = await fetch(`${BASE_URL}/api/user/subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({ tier: "PRO" }),
  });
  const studentProBody = await studentProRes.json();
  console.log(`[HTTP ${studentProRes.status}] Student POST user/subscription { tier: 'PRO' } ->`, studentProBody.error || studentProBody);
  assert(studentProRes.status === 402, `Authenticated student self-granting PRO tier rejected with 402 Payment Required (got ${studentProRes.status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. DEMO FACULTY AUTHORIZATION (MUST BE 200 ON ROSTER)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Testing Demo Faculty Authorization ---");
  const facultyRosterRes = await fetch(`${BASE_URL}/api/campus/cohort/ECE-204-EMBEDDED?view=roster`, {
    headers: { Cookie: facultyCookie },
  });
  const facultyRosterBody = await facultyRosterRes.json();
  console.log(`[HTTP ${facultyRosterRes.status}] Demo Faculty GET cohort roster -> Loaded ${facultyRosterBody.cohort?.allSubmissions?.length ?? 0} student submissions`);
  assert(facultyRosterRes.status === 200, `Demo faculty receives 200 OK on cohort roster view (got ${facultyRosterRes.status})`);
  assert(Boolean(facultyRosterBody.cohort?.assignments), "Demo faculty view includes full assignment list");

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SEPARATE UNAUTHENTICATED 401 CHECKS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Testing Unauthenticated 401 Boundary Checks ---");

  // 4a. Unauthenticated assignment create -> 401
  const unauthAsg = await fetch(`${BASE_URL}/api/campus/assignment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "ECE-204-EMBEDDED", title: "Test", challengeId: "x" }),
  });
  console.log(`[HTTP ${unauthAsg.status}] Unauthenticated POST /api/campus/assignment/create`);
  assert(unauthAsg.status === 401, `Unauthenticated assignment create returns 401 (got ${unauthAsg.status})`);

  // 4b. Unauthenticated settings update -> 401
  const unauthSettings = await fetch(`${BASE_URL}/api/user/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Hacker" }),
  });
  console.log(`[HTTP ${unauthSettings.status}] Unauthenticated POST /api/user/settings`);
  assert(unauthSettings.status === 401, `Unauthenticated settings update returns 401 (got ${unauthSettings.status})`);

  // 4c. Unauthenticated subscription tier update -> 401
  const unauthSub = await fetch(`${BASE_URL}/api/user/subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier: "PRO" }),
  });
  console.log(`[HTTP ${unauthSub.status}] Unauthenticated POST /api/user/subscription`);
  assert(unauthSub.status === 401, `Unauthenticated subscription request returns 401 (got ${unauthSub.status})`);

  // 4d. Unauthenticated cohort creation with invalid secret -> 401
  const unauthCohort = await fetch(`${BASE_URL}/api/campus/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "CS-999", title: "Bad", institution: "Bad U", facultyPasscode: "WRONG" }),
  });
  console.log(`[HTTP ${unauthCohort.status}] Unauthenticated POST /api/campus/create`);
  assert(unauthCohort.status === 401, `Unauthenticated cohort create with bad passcode returns 401 (got ${unauthCohort.status})`);

  // 4e. Wrong faculty verification passcode -> 403
  const badFacultyPasscode = await fetch(`${BASE_URL}/api/campus/verify-faculty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode: "WRONG_SECRET" }),
  });
  console.log(`[HTTP ${badFacultyPasscode.status}] POST /api/campus/verify-faculty (wrong key)`);
  assert(badFacultyPasscode.status === 403, `Wrong faculty verification passcode returns 403 (got ${badFacultyPasscode.status})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. PRODUCTION GUEST & DEMO GATING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Testing Production Guest & Demo Faculty Gating ---");
  const credentialsProvider = authOptions.providers.find((p) => p.id === "credentials") as any;
  const authorizeFn = credentialsProvider?.options?.authorize || credentialsProvider?.authorize;

  const oldNodeEnv = process.env.NODE_ENV;
  const oldAllowGuest = process.env.ALLOW_GUEST_LOGIN;
  const oldDemoMode = process.env.DEMO_MODE;
  try {
    (process.env as any).NODE_ENV = "production";
    delete process.env.ALLOW_GUEST_LOGIN;
    delete process.env.DEMO_MODE;

    // In production without ALLOW_GUEST_LOGIN, authorize must reject guest login
    let guestThrew = false;
    try {
      await authorizeFn({ guestId: "1", username: "Student_Guest" });
    } catch (e: any) {
      guestThrew = true;
      console.log("Guest rejection in production without ALLOW_GUEST_LOGIN:", e.message);
    }
    assert(guestThrew, "Guest credentials authorize throws in production when ALLOW_GUEST_LOGIN is unset");

    // In production without DEMO_MODE, demo faculty login must reject
    let facultyThrew = false;
    try {
      await authorizeFn({ guestId: "faculty", username: "Dr. Vikram Malhotra" });
    } catch (e: any) {
      facultyThrew = true;
      console.log("Demo faculty rejection in production without DEMO_MODE:", e.message);
    }
    assert(facultyThrew, "Demo faculty login throws in production unless DEMO_MODE=true");

    // When DEMO_MODE=true and ALLOW_GUEST_LOGIN=true, both succeed
    process.env.ALLOW_GUEST_LOGIN = "true";
    process.env.DEMO_MODE = "true";
    const studentUser = await authorizeFn({ guestId: "1", username: "Student_Alpha" });
    assert(studentUser?.id === "guest_1", `Student login succeeds with ALLOW_GUEST_LOGIN=true (id: ${studentUser?.id})`);

    const demoFacultyUser = await authorizeFn({ guestId: "faculty", username: "Dr. Vikram Malhotra" });
    assert(demoFacultyUser?.id === "faculty_vikram_malhotra", `Demo faculty login creates separate user with fictional domain (email: ${demoFacultyUser?.email})`);
    assert(demoFacultyUser?.email?.endsWith("@demo-campus.test"), `Demo faculty email uses fictional domain (got ${demoFacultyUser?.email})`);
  } finally {
    (process.env as any).NODE_ENV = oldNodeEnv;
    if (oldAllowGuest !== undefined) process.env.ALLOW_GUEST_LOGIN = oldAllowGuest;
    else delete process.env.ALLOW_GUEST_LOGIN;
    if (oldDemoMode !== undefined) process.env.DEMO_MODE = oldDemoMode;
    else delete process.env.DEMO_MODE;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. ATOMIC HINT QUOTA CONCURRENCY (DYNAMODB SEMANTICS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Testing Atomic Hint Quota Under Parallel Requests ---");

  const testMatchId = `test-quota-match-${Date.now()}`;
  const testUserId = "test_player_concurrency";

  // Seed match in DB with hintsUsed = 2 (limit = 3, exactly 1 slot left)
  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `MATCH#${testMatchId}`,
        SK: "META",
        matchId: testMatchId,
        status: "active",
        challengeId: "swe-url-query-sanitizer",
        track: "PRODUCTION_SWE",
        startedAt: Date.now(),
        player1: {
          userId: testUserId,
          username: "ConcurrencyTester",
          hintsUsed: 2,
        },
        player2: {
          userId: "bot_sentinel",
          username: "Sentinel AI",
          hintsUsed: 0,
        },
      },
    })
  );

  console.log(`Seeded test match ${testMatchId} with player1.hintsUsed = 2 (limit = 3)`);

  const sendAtomicReservation = async (reqIndex: number) => {
    try {
      const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
      await dynamo.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `MATCH#${testMatchId}`, SK: "META" },
          UpdateExpression: "SET player1.hintsUsed = if_not_exists(player1.hintsUsed, :zero) + :one",
          ConditionExpression: "attribute_not_exists(player1.hintsUsed) OR player1.hintsUsed < :maxHints",
          ExpressionAttributeValues: {
            ":zero": 0,
            ":one": 1,
            ":maxHints": 3,
          },
        })
      );
      return { reqIndex, status: 200, success: true };
    } catch (err: any) {
      const isCondFail =
        err?.name === "ConditionalCheckFailedException" ||
        err?.message?.includes("conditional") ||
        err?.message?.includes("ConditionalCheckFailed");
      return { reqIndex, status: 429, success: false, isCondFail };
    }
  };

  // Dispatch 5 simultaneous parallel requests
  const parallelResults = await Promise.all([
    sendAtomicReservation(1),
    sendAtomicReservation(2),
    sendAtomicReservation(3),
    sendAtomicReservation(4),
    sendAtomicReservation(5),
  ]);

  console.log("Parallel Request Results:");
  parallelResults.forEach((r) => {
    console.log(`  Request #${r.reqIndex}: Status ${r.status} (${r.success ? "RESERVED" : "BLOCKED 429"})`);
  });

  const successfulReservations = parallelResults.filter((r) => r.status === 200).length;
  const rejectedRequests = parallelResults.filter((r) => r.status === 429).length;

  assert(successfulReservations === 1, `Exactly 1 parallel request succeeds when 1 slot remains (got ${successfulReservations})`);
  assert(rejectedRequests === 4, `All 4 excess parallel requests were blocked with 429 (got ${rejectedRequests})`);

  // Verify final database state
  const updatedMatch = await dynamo.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `MATCH#${testMatchId}`, SK: "META" },
    })
  );
  const finalHintsUsed = updatedMatch.Item?.player1?.hintsUsed;
  console.log("Final hintsUsed in database:", finalHintsUsed);
  assert(finalHintsUsed === 3, `Database hintsUsed clamped strictly at 3 (got ${finalHintsUsed})`);

  console.log("\n=================================================");
  console.log(`RESULT: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("=================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
