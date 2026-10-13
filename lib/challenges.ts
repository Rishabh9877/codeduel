// =============================================================================
// SEED CHALLENGES — Production Bug-Fixing Battleground
// =============================================================================
//
// CodeDuel has pivoted away from textbook DSA puzzles (Two Sum, Tree Inversions).
// Instead, developers race to resolve REAL-WORLD production tickets across two
// distinct engineering tracks:
//
//   1. PRODUCTION_SWE   — TypeScript/Node microservice bugs
//   2. EMBEDDED_SYSTEMS  — C/C++ firmware & driver bugs
//
// Each challenge is a multi-file codebase with a deliberate bug. Players inspect
// the bug report (ticketMarkdown), navigate the modular architecture, patch the
// editable file (readOnly: false), and satisfy the automated test suite.
//
// The test runner (entrypoint) is executed via Piston API and outputs a
// deterministic SUMMARY line: "SUMMARY: X/Y PASSED"
// =============================================================================

export interface ChallengeFile {
  name: string;
  content: string;
  readOnly: boolean;
}

export interface Challenge {
  id: string;
  track: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS';
  language: 'typescript' | 'c' | 'python';
  title: string;
  repoContext: string; // e.g. "open-telemetry/rate-limiter" or "zephyr-project/uart-ringbuf"
  ticketMarkdown: string;
  files: ChallengeFile[];
  entrypoint: string; // File executed by Piston
  totalTests: number;
}

export const SEED_CHALLENGES: Record<string, Challenge> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: PRODUCTION_SWE — TypeScript / Node.js Microservice Bugs
  // ═══════════════════════════════════════════════════════════════════════════

  'swe-token-bucket': {
    id: 'swe-token-bucket',
    track: 'PRODUCTION_SWE',
    language: 'typescript',
    title: 'PR #108: Fix Sub-Second Token Starvation in RateLimiter',
    repoContext: 'oss-gateway/rate-limiter',
    ticketMarkdown: `### 🚨 Bug Report: Upstream Dropping Sub-Second Bursts

Users report sporadic HTTP 429 errors during concurrent bursts.

**Root Cause:** In \`rateLimiter.ts\`, the token regeneration logic calculates elapsed time using \`Math.floor((now - lastRefill) / 1000)\`. Fractional seconds are truncated to zero, causing the bucket to never replenish between high-frequency bursts under 1 second.

**Fix Required:** Calculate precise fractional milliseconds refill or accumulate residual milliseconds properly.`,
    entrypoint: 'runner.ts',
    totalTests: 3,
    files: [
      {
        name: 'types.ts',
        readOnly: true,
        content: `export interface BucketConfig {
  maxCapacity: number;
  refillRatePerSec: number;
}
export interface BucketState {
  tokens: number;
  lastRefillMs: number;
}`
      },
      {
        name: 'rateLimiter.ts',
        readOnly: false,
        content: `import { BucketConfig, BucketState } from './types';

export class TokenBucketLimiter {
  constructor(public config: BucketConfig, public state: BucketState) {}

  consume(tokensRequested: number = 1): boolean {
    const now = Date.now();
    // BUG: Truncating to integer seconds drops fractional refills
    const elapsedSeconds = Math.floor((now - this.state.lastRefillMs) / 1000);
    
    if (elapsedSeconds > 0) {
      this.state.tokens = Math.min(
        this.config.maxCapacity,
        this.state.tokens + elapsedSeconds * this.config.refillRatePerSec
      );
      this.state.lastRefillMs = now;
    }

    if (this.state.tokens >= tokensRequested) {
      this.state.tokens -= tokensRequested;
      return true;
    }
    return false;
  }
}`
      },
      {
        name: 'runner.ts',
        readOnly: true,
        content: `import { TokenBucketLimiter } from './rateLimiter';

let passed = 0;

// Test 1: Capacity drain check
const limiter = new TokenBucketLimiter({ maxCapacity: 5, refillRatePerSec: 10 }, { tokens: 5, lastRefillMs: Date.now() });
if (limiter.consume(3) && limiter.consume(2) && !limiter.consume(1)) {
  console.log("[PASS] TEST_1: Burst drain enforcement");
  passed++;
} else {
  console.log("[FAIL] TEST_1: Burst drain enforcement failed");
}

// Test 2: Sub-second refill (300ms elapsed should generate tokens if rate is 10/sec)
const subSecLimiter = new TokenBucketLimiter({ maxCapacity: 10, refillRatePerSec: 10 }, { tokens: 0, lastRefillMs: Date.now() - 500 });
// 500ms at 10 tokens/sec should yield at least 5 tokens
if (subSecLimiter.consume(3)) {
  console.log("[PASS] TEST_2: Sub-second fractional token replenish");
  passed++;
} else {
  console.log("[FAIL] TEST_2: Sub-second fractional token replenish failed");
}

// Test 3: Capacity clamping
const overLimiter = new TokenBucketLimiter({ maxCapacity: 5, refillRatePerSec: 10 }, { tokens: 4, lastRefillMs: Date.now() - 5000 });
overLimiter.consume(1);
if (overLimiter.state.tokens <= 5) {
  console.log("[PASS] TEST_3: Token capacity cap limit");
  passed++;
} else {
  console.log("[FAIL] TEST_3: Token capacity cap limit failed");
}

console.log(\`SUMMARY: \${passed}/3 PASSED\`);
if (passed === 3) process.exit(0);
else process.exit(1);`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: EMBEDDED_SYSTEMS — C Firmware / Driver Bugs
  // ═══════════════════════════════════════════════════════════════════════════

  'embedded-ring-buffer': {
    id: 'embedded-ring-buffer',
    track: 'EMBEDDED_SYSTEMS',
    language: 'c',
    title: 'Issue #44: UART ISR Dropping Bytes on Ring Buffer Wrap-Around',
    repoContext: 'embedded-os/drivers/serial',
    ticketMarkdown: `### 🚨 Hardware Driver Alert: Dropped UART Packets

High-speed serial frames (115200 baud) are dropping bytes during RX FIFO buffer wrap-around.

**Root Cause:** In \`ring_buffer.c\`, the condition for \`rb_is_full\` checks \`head == tail\`, which collides with the \`rb_is_empty\` state. Furthermore, write pointer incrementation fails to wrap around using the buffer mask.

**Fix Required:** Fix pointer calculation and ensure full vs. empty state detection preserves FIFO integrity.`,
    entrypoint: 'test_runner.c',
    totalTests: 3,
    files: [
      {
        name: 'ring_buffer.h',
        readOnly: true,
        content: `#ifndef RING_BUFFER_H
#define RING_BUFFER_H

#include <stdint.h>
#include <stdbool.h>

#define RB_SIZE 8

typedef struct {
    uint8_t buffer[RB_SIZE];
    volatile uint8_t head;
    volatile uint8_t tail;
    volatile uint8_t count;
} RingBuffer;

void rb_init(RingBuffer *rb);
bool rb_write(RingBuffer *rb, uint8_t data);
bool rb_read(RingBuffer *rb, uint8_t *data);
bool rb_is_full(const RingBuffer *rb);
bool rb_is_empty(const RingBuffer *rb);

#endif`
      },
      {
        name: 'ring_buffer.c',
        readOnly: false,
        content: `#include "ring_buffer.h"

void rb_init(RingBuffer *rb) {
    rb->head = 0;
    rb->tail = 0;
    rb->count = 0;
}

bool rb_is_full(const RingBuffer *rb) {
    // BUG: Confusing full with empty state
    return (rb->head == rb->tail);
}

bool rb_is_empty(const RingBuffer *rb) {
    return (rb->count == 0);
}

bool rb_write(RingBuffer *rb, uint8_t data) {
    if (rb_is_full(rb)) return false;
    rb->buffer[rb->head] = data;
    // BUG: Missing modulo/mask wrap-around
    rb->head++; 
    rb->count++;
    return true;
}

bool rb_read(RingBuffer *rb, uint8_t *data) {
    if (rb_is_empty(rb)) return false;
    *data = rb->buffer[rb->tail];
    rb->tail = (rb->tail + 1) % RB_SIZE;
    rb->count--;
    return true;
}`
      },
      {
        name: 'test_runner.c',
        readOnly: true,
        content: `#include <stdio.h>
#include <stdlib.h>
#include "ring_buffer.h"
#include "ring_buffer.c" // Included directly for single-pass Piston C compilation

int main() {
    int passed = 0;
    RingBuffer rb;
    rb_init(&rb);

    // Test 1: Empty and Simple Write
    if (rb_is_empty(&rb) && !rb_is_full(&rb)) {
        rb_write(&rb, 0xAA);
        uint8_t val = 0;
        rb_read(&rb, &val);
        if (val == 0xAA && rb_is_empty(&rb)) {
            printf("[PASS] TEST_1: FIFO Read/Write\\n");
            passed++;
        }
    }

    // Test 2: Full Buffer Saturation
    rb_init(&rb);
    for (int i = 0; i < RB_SIZE; i++) {
        rb_write(&rb, (uint8_t)i);
    }
    if (rb_is_full(&rb) && !rb_write(&rb, 0xFF)) {
        printf("[PASS] TEST_2: Saturation Boundary Check\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_2: Overwrote full buffer\\n");
    }

    // Test 3: Wrap-Around Boundary Execution
    rb_init(&rb);
    for (int i = 0; i < 6; i++) rb_write(&rb, (uint8_t)i);
    uint8_t dummy;
    for (int i = 0; i < 4; i++) rb_read(&rb, &dummy); // tail moves ahead
    // Now write 4 more bytes pushing head beyond RB_SIZE
    for (int i = 0; i < 4; i++) rb_write(&rb, (uint8_t)(0x10 + i));
    
    uint8_t extracted = 0;
    rb_read(&rb, &extracted);
    if (extracted == 4) { // Next unread was index 4
        printf("[PASS] TEST_3: Pointer Wrap-Around\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_3: Wrap-Around Corruption\\n");
    }

    printf("SUMMARY: %d/3 PASSED\\n", passed);
    return (passed == 3) ? 0 : 1;
}`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: PRODUCTION_SWE — Additional Microservice Incident
  // ═══════════════════════════════════════════════════════════════════════════

  'swe-retry-backoff': {
    id: 'swe-retry-backoff',
    track: 'PRODUCTION_SWE',
    language: 'typescript',
    title: 'PR #242: Fix Exponential Backoff Jitter Clamping in RPC Gateway',
    repoContext: 'open-mesh/rpc-gateway',
    ticketMarkdown: `### 🚨 Outage Alert: Thundering Herd from Negative Backoff Delays

During upstream network blips, client retries trigger instant retry cascades instead of waiting.

**Root Cause:** In \`backoff.ts\`, the full jitter calculation subtracts a fixed offset without lower bound clamping. When \`attempt = 0\` and \`baseDelayMs = 100\`, subtracting up to 1000ms causes delays to compute as negative numbers, firing retries instantly.

**Fix Required:** Ensure retry delay is strictly non-negative and bounded within the jitter envelope.`,
    entrypoint: 'runner.ts',
    totalTests: 3,
    files: [
      {
        name: 'types.ts',
        readOnly: true,
        content: `export interface BackoffConfig {
  baseDelayMs: number;
  maxDelayMs: number;
}`
      },
      {
        name: 'backoff.ts',
        readOnly: false,
        content: `import { BackoffConfig } from './types';

export function computeRetryDelay(attempt: number, config: BackoffConfig): number {
  const exponentialCap = Math.min(config.maxDelayMs, config.baseDelayMs * Math.pow(2, attempt));
  // BUG: Subtracting fixed random offset produces negative or zero delays on early attempts
  const delay = exponentialCap - Math.random() * 1000;
  return delay;
}`
      },
      {
        name: 'runner.ts',
        readOnly: true,
        content: `import { computeRetryDelay } from './backoff';

let passed = 0;
const cfg = { baseDelayMs: 100, maxDelayMs: 2000 };

// Test 1: Delay must never be negative
let nonNegative = true;
for (let i = 0; i < 20; i++) {
  const d = computeRetryDelay(0, cfg);
  if (d < 0) { nonNegative = false; break; }
}
if (nonNegative) {
  console.log("[PASS] TEST_1: Non-negative delay boundary");
  passed++;
} else {
  console.log("[FAIL] TEST_1: Produced negative backoff delay");
}

// Test 2: Exponential growth ceiling
const lateAttempt = computeRetryDelay(10, cfg);
if (lateAttempt <= cfg.maxDelayMs && lateAttempt >= 0) {
  console.log("[PASS] TEST_2: Max delay capping");
  passed++;
} else {
  console.log("[FAIL] TEST_2: Delay exceeded maxDelayMs");
}

// Test 3: Progressive variance between attempt 0 and attempt 3
let averageAttempt0 = 0;
let averageAttempt3 = 0;
for (let i = 0; i < 50; i++) {
  averageAttempt0 += computeRetryDelay(0, cfg);
  averageAttempt3 += computeRetryDelay(3, cfg);
}
if (averageAttempt3 > averageAttempt0) {
  console.log("[PASS] TEST_3: Progressive backoff scaling");
  passed++;
} else {
  console.log("[FAIL] TEST_3: Exponential backoff did not increase with attempts");
}

console.log(\`SUMMARY: \${passed}/3 PASSED\`);
if (passed === 3) process.exit(0);
else process.exit(1);`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: EMBEDDED_SYSTEMS — Additional Electronics Incident
  // ═══════════════════════════════════════════════════════════════════════════

  'embedded-gpio-debounce': {
    id: 'embedded-gpio-debounce',
    track: 'EMBEDDED_SYSTEMS',
    language: 'c',
    title: 'Issue #92: Mechanical Contact Bounce Glitch on Pin ISR',
    repoContext: 'zephyr-rtos/drivers/gpio',
    ticketMarkdown: `### 🚨 Firmware Bug: Spurious Dual Actuation on Mechanical Switch

Tactile pushbutton presses generate intermittent noisy pulses (5-15ms bounce).

**Root Cause:** In \`gpio_debounce.c\`, the state validator commits state transitions on every pin event without checking whether \`elapsed_ms >= DEBOUNCE_THRESHOLD_MS\`.

**Fix Required:** Filter transient oscillations until the signal remains stable past the threshold window before toggling \`stable_state\`.`,
    entrypoint: 'test_runner.c',
    totalTests: 3,
    files: [
      {
        name: 'debounce.h',
        readOnly: true,
        content: `#ifndef DEBOUNCE_H
#define DEBOUNCE_H

#include <stdint.h>
#include <stdbool.h>

#define DEBOUNCE_THRESHOLD_MS 20

typedef struct {
    bool stable_state;
    bool last_raw_sample;
    uint32_t last_transition_ms;
} Debouncer;

void debouncer_init(Debouncer *d, bool initial_level, uint32_t current_time_ms);
bool debouncer_update(Debouncer *d, bool raw_sample, uint32_t current_time_ms);

#endif`
      },
      {
        name: 'gpio_debounce.c',
        readOnly: false,
        content: `#include "debounce.h"

void debouncer_init(Debouncer *d, bool initial_level, uint32_t current_time_ms) {
    d->stable_state = initial_level;
    d->last_raw_sample = initial_level;
    d->last_transition_ms = current_time_ms;
}

// Returns true ONLY when a confirmed, stable transition has occurred
bool debouncer_update(Debouncer *d, bool raw_sample, uint32_t current_time_ms) {
    // If raw sample differs from last seen sample, reset timer
    if (raw_sample != d->last_raw_sample) {
        d->last_raw_sample = raw_sample;
        d->last_transition_ms = current_time_ms;
    }

    // BUG: Immediately updates stable_state without waiting for threshold
    if (raw_sample != d->stable_state) {
        d->stable_state = raw_sample;
        return true;
    }
    return false;
}`
      },
      {
        name: 'test_runner.c',
        readOnly: true,
        content: `#include <stdio.h>
#include <stdlib.h>
#include "debounce.h"
#include "gpio_debounce.c"

int main() {
    int passed = 0;
    Debouncer d;
    debouncer_init(&d, false, 0);

    // Test 1: Immediate noise rejection (< 20ms)
    bool noise_triggered = debouncer_update(&d, true, 5);
    if (!noise_triggered && d.stable_state == false) {
        printf("[PASS] TEST_1: Transient Glitch Filtering\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_1: Spurious trigger on noisy glitch\\n");
    }

    // Test 2: Valid sustained signal transitions state
    debouncer_init(&d, false, 0);
    debouncer_update(&d, true, 5);  // initial edge
    debouncer_update(&d, true, 12); // intermediate sample
    bool transition_valid = debouncer_update(&d, true, 30); // 25ms sustained (> 20ms threshold)
    if (transition_valid && d.stable_state == true) {
        printf("[PASS] TEST_2: Sustained Signal Acknowledged\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_2: Failed to latch sustained signal\\n");
    }

    // Test 3: Steady state produces no false events
    bool steady_state = debouncer_update(&d, true, 40);
    if (!steady_state && d.stable_state == true) {
        printf("[PASS] TEST_3: Quiescent Stability\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_3: Steady state generated extra event\\n");
    }

    printf("SUMMARY: %d/3 PASSED\\n", passed);
    return (passed == 3) ? 0 : 1;
}`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: PRODUCTION_SWE — JWT Algorithm Confusion
  // ═══════════════════════════════════════════════════════════════════════════

  'swe-jwt-alg-confusion': {
    id: 'swe-jwt-alg-confusion',
    track: 'PRODUCTION_SWE',
    language: 'typescript',
    title: 'CVE-2024-8812: Fix Signature Bypass on "none" Algorithm in Auth Middleware',
    repoContext: 'open-auth/jwt-verify',
    ticketMarkdown: `### 🚨 Critical Vulnerability Alert: Authentication Bypass via "none" Algorithm

Security audits detected that an attacker can forge admin JWT tokens by supplying \`{"alg": "none"}\` or casing variants (\`{"alg": "NONE"}\`), completely skipping signature verification.

**Root Cause:** In \`verifier.ts\`, the verifier checks \`if (header.alg === "none")\` without normalizing to uppercase, and fails to reject tokens whose algorithm is not in \`options.allowedAlgorithms\`.

**Fix Required:** 
1. Always normalize the algorithm name (case-insensitive check).
2. If \`options.allowedAlgorithms\` is provided, reject any token with an algorithm not explicitly listed.
3. Tokens with \`alg: "none"\` must NEVER be accepted unless \`"NONE"\` is explicitly in \`options.allowedAlgorithms\`.`,
    entrypoint: 'runner.ts',
    totalTests: 3,
    files: [
      {
        name: 'types.ts',
        readOnly: true,
        content: `export interface JwtHeader {
  alg: string;
  typ?: string;
}
export interface JwtPayload {
  sub: string;
  role: string;
  exp?: number;
  [key: string]: any;
}
export interface VerificationOptions {
  allowedAlgorithms?: string[];
}
export interface VerificationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}`
      },
      {
        name: 'verifier.ts',
        readOnly: false,
        content: `import { JwtHeader, JwtPayload, VerificationOptions, VerificationResult } from './types';

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function verifyToken(
  token: string,
  secretKey: string,
  options: VerificationOptions = {}
): VerificationResult {
  const parts = token.split('.');
  if (parts.length < 2) {
    return { valid: false, error: 'Malformed token' };
  }

  let header: JwtHeader;
  let payload: JwtPayload;

  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (e) {
    return { valid: false, error: 'Invalid JSON encoding' };
  }

  // BUG: Direct string comparison without case normalization allows "NONE" or "None" bypass.
  // BUG: Does not enforce options.allowedAlgorithms.
  if (header.alg === 'none') {
    return { valid: true, payload };
  }

  const signature = parts[2] || '';
  if (!signature || signature !== \`sig_\${secretKey}\`) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true, payload };
}`
      },
      {
        name: 'runner.ts',
        readOnly: true,
        content: `import { verifyToken } from './verifier';

let passed = 0;

function b64(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
}

const secret = 'super_secret_key';

// Test 1: Valid signed token passes with allowed algorithm
const validHeader = b64({ alg: 'HS256', typ: 'JWT' });
const validPayload = b64({ sub: 'user_1', role: 'developer' });
const validToken = \`\${validHeader}.\${validPayload}.sig_\${secret}\`;

const res1 = verifyToken(validToken, secret, { allowedAlgorithms: ['HS256'] });
if (res1.valid && res1.payload?.sub === 'user_1') {
  console.log('[PASS] TEST_1: Valid token signature accepted');
  passed++;
} else {
  console.log('[FAIL] TEST_1: Valid token was rejected: ' + res1.error);
}

// Test 2: Reject uppercase "NONE" bypass attempt
const forgedHeader = b64({ alg: 'NONE', typ: 'JWT' });
const forgedPayload = b64({ sub: 'admin', role: 'root' });
const forgedToken = \`\${forgedHeader}.\${forgedPayload}.\`;

const res2 = verifyToken(forgedToken, secret, { allowedAlgorithms: ['HS256'] });
if (!res2.valid) {
  console.log('[PASS] TEST_2: Uppercase NONE algorithm bypass rejected');
  passed++;
} else {
  console.log('[FAIL] TEST_2: Uppercase NONE algorithm bypass allowed');
}

// Test 3: Reject disallowed algorithm even if signature looks right
const unallowedHeader = b64({ alg: 'RS256', typ: 'JWT' });
const unallowedPayload = b64({ sub: 'guest', role: 'user' });
const unallowedToken = \`\${unallowedHeader}.\${unallowedPayload}.sig_\${secret}\`;

const res3 = verifyToken(unallowedToken, secret, { allowedAlgorithms: ['HS256'] });
if (!res3.valid) {
  console.log('[PASS] TEST_3: Disallowed algorithm rejected');
  passed++;
} else {
  console.log('[FAIL] TEST_3: Disallowed algorithm was incorrectly accepted');
}

console.log(\`SUMMARY: \${passed}/3 PASSED\`);
if (passed === 3) process.exit(0);
else process.exit(1);`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: PRODUCTION_SWE — Connection Pool Leak
  // ═══════════════════════════════════════════════════════════════════════════

  'swe-connection-pool-leak': {
    id: 'swe-connection-pool-leak',
    track: 'PRODUCTION_SWE',
    language: 'typescript',
    title: 'Issue #419: Resolve Connection Pool Starvation Under Uncaught Query Errors',
    repoContext: 'hyper-db/pool-manager',
    ticketMarkdown: `### 🚨 Production Outage: Database Connection Pool Exhausted

During peak traffic, sporadic upstream database timeouts or syntax errors leave connection handles allocated, reducing available connections to zero.

**Root Cause:** In \`pool.ts\`, \`withConnection(fn)\` acquires a client handle, awaits \`fn(conn)\`, and only releases the connection upon successful resolution. When \`fn\` throws or rejects, \`release(conn)\` is skipped, leaking the connection.

**Fix Required:** Wrap the query execution in a \`try...finally\` block so that the acquired connection is unconditionally returned to the idle pool regardless of success or failure.`,
    entrypoint: 'runner.ts',
    totalTests: 3,
    files: [
      {
        name: 'types.ts',
        readOnly: true,
        content: `export interface Connection {
  id: number;
  inUse: boolean;
}
export interface PoolConfig {
  maxConnections: number;
}`
      },
      {
        name: 'pool.ts',
        readOnly: false,
        content: `import { Connection, PoolConfig } from './types';

export class ConnectionPool {
  private connections: Connection[] = [];
  private activeCount: number = 0;

  constructor(public config: PoolConfig) {
    for (let i = 0; i < config.maxConnections; i++) {
      this.connections.push({ id: i + 1, inUse: false });
    }
  }

  acquire(): Connection {
    const conn = this.connections.find((c) => !c.inUse);
    if (!conn) {
      throw new Error('PoolExhaustedError: No connections available');
    }
    conn.inUse = true;
    this.activeCount++;
    return conn;
  }

  release(conn: Connection): void {
    if (conn.inUse) {
      conn.inUse = false;
      this.activeCount--;
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  async withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    const conn = this.acquire();
    // BUG: Missing try/finally block. If fn() throws, conn is never released.
    const result = await fn(conn);
    this.release(conn);
    return result;
  }
}`
      },
      {
        name: 'runner.ts',
        readOnly: true,
        content: `import { ConnectionPool } from './pool';

let passed = 0;

async function run() {
  const pool = new ConnectionPool({ maxConnections: 3 });

  // Test 1: Clean execution acquires and releases
  try {
    const val = await pool.withConnection(async (c) => \`data_\${c.id}\`);
    if (val.startsWith('data_') && pool.getActiveCount() === 0) {
      console.log('[PASS] TEST_1: Normal execution releases connection');
      passed++;
    } else {
      console.log('[FAIL] TEST_1: Leaked connection after normal execution');
    }
  } catch (err: any) {
    console.log('[FAIL] TEST_1: Threw unexpected error: ' + err.message);
  }

  // Test 2: Error path must release connection
  try {
    await pool.withConnection(async () => {
      throw new Error('Simulated Query Timeout');
    });
  } catch (expectedErr) {
    // Expected to throw
  }

  if (pool.getActiveCount() === 0) {
    console.log('[PASS] TEST_2: Error execution releases connection via finally');
    passed++;
  } else {
    console.log('[FAIL] TEST_2: Active connection leaked after error: ' + pool.getActiveCount());
  }

  // Test 3: Multiple failed bursts do not exhaust pool
  for (let i = 0; i < 6; i++) {
    try {
      await pool.withConnection(async () => {
        if (i % 2 === 0) throw new Error('Fault');
        return i;
      });
    } catch (_) {}
  }

  if (pool.getActiveCount() === 0) {
    console.log('[PASS] TEST_3: Repeated faults do not cause pool exhaustion');
    passed++;
  } else {
    console.log('[FAIL] TEST_3: Pool exhausted after fault burst');
  }

  console.log(\`SUMMARY: \${passed}/3 PASSED\`);
  if (passed === 3) process.exit(0);
  else process.exit(1);
}

run();`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: PRODUCTION_SWE — Cache Stampede SingleFlight
  // ═══════════════════════════════════════════════════════════════════════════

  'swe-cache-stampede': {
    id: 'swe-cache-stampede',
    track: 'PRODUCTION_SWE',
    language: 'typescript',
    title: 'PR #145: SingleFlight Coalescing to Prevent Cache Stampede on Key Expiry',
    repoContext: 'cache-mesh/in-memory-lru',
    ticketMarkdown: `### 🚨 Production Alert: High CPU and DB Spikes on Cache Key Invalidation

When a hot cache key expires, 50+ concurrent HTTP handlers simultaneously encounter a cache miss and each invoke the expensive upstream database query (Thundering Herd problem).

**Root Cause:** In \`cache.ts\`, \`SingleFlightCache.getOrFetch\` checks whether the key exists in memory. If not, it directly invokes the \`fetcher()\` for each caller without deduplicating requests via an in-flight promise map.

**Fix Required:** 
1. Maintain an \`inFlight: Map<string, Promise<T>>\` of active fetch promises.
2. If an identical key is already being fetched, return the existing in-flight promise instead of launching a new fetch.
3. Once the promise resolves or rejects, remove it from \`inFlight\`.`,
    entrypoint: 'runner.ts',
    totalTests: 3,
    files: [
      {
        name: 'types.ts',
        readOnly: true,
        content: `export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}`
      },
      {
        name: 'cache.ts',
        readOnly: false,
        content: `import { CacheEntry } from './types';

export class SingleFlightCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private inFlight = new Map<string, Promise<T>>();

  constructor(private ttlMs: number = 5000) {}

  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    // BUG: Missing SingleFlight promise coalescing.
    // Every concurrent caller invokes fetcher() instead of sharing an inFlight promise!
    const value = await fetcher();
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}`
      },
      {
        name: 'runner.ts',
        readOnly: true,
        content: `import { SingleFlightCache } from './cache';

let passed = 0;

async function run() {
  const cache = new SingleFlightCache<string>(500);

  // Test 1: Cache hit returns cached value
  let callCount1 = 0;
  const fetcher1 = async () => {
    callCount1++;
    return 'value_1';
  };
  await cache.getOrFetch('k1', fetcher1);
  await cache.getOrFetch('k1', fetcher1);
  if (callCount1 === 1) {
    console.log('[PASS] TEST_1: Sequential cache hits avoid re-fetching');
    passed++;
  } else {
    console.log('[FAIL] TEST_1: Cache hit re-invoked fetcher: ' + callCount1);
  }

  // Test 2: Concurrent requests are coalesced into a single fetch
  let callCount2 = 0;
  const delayedFetcher = async () => {
    callCount2++;
    await new Promise((r) => setTimeout(r, 40));
    return 'value_concurrent';
  };

  const results = await Promise.all([
    cache.getOrFetch('k2', delayedFetcher),
    cache.getOrFetch('k2', delayedFetcher),
    cache.getOrFetch('k2', delayedFetcher),
    cache.getOrFetch('k2', delayedFetcher),
  ]);

  if (callCount2 === 1 && results.every((v) => v === 'value_concurrent')) {
    console.log('[PASS] TEST_2: Concurrent requests coalesced into single fetch');
    passed++;
  } else {
    console.log('[FAIL] TEST_2: Cache stampede occurred. Fetch count: ' + callCount2);
  }

  // Test 3: Failed fetch cleans up in-flight promise and allows retry
  let callCount3 = 0;
  const failingFetcher = async () => {
    callCount3++;
    throw new Error('Fetch failed');
  };

  try {
    await cache.getOrFetch('k3', failingFetcher);
  } catch (_) {}

  // Next call should attempt again rather than hanging on failed promise
  const succeedingFetcher = async () => 'recovered';
  try {
    const val = await cache.getOrFetch('k3', succeedingFetcher);
    if (val === 'recovered') {
      console.log('[PASS] TEST_3: Failed in-flight fetch cleans up and permits recovery');
      passed++;
    } else {
      console.log('[FAIL] TEST_3: Did not recover value');
    }
  } catch (err: any) {
    console.log('[FAIL] TEST_3: Hanging or uncleaned in-flight promise: ' + err.message);
  }

  console.log(\`SUMMARY: \${passed}/3 PASSED\`);
  if (passed === 3) process.exit(0);
  else process.exit(1);
}

run();`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: EMBEDDED_SYSTEMS — SPI IMU Endianness Packing
  // ═══════════════════════════════════════════════════════════════════════════

  'embedded-spi-endianness': {
    id: 'embedded-spi-endianness',
    track: 'EMBEDDED_SYSTEMS',
    language: 'c',
    title: 'Issue #117: Fix 16-Bit IMU Sensor Telemetry Endianness Packing',
    repoContext: 'aerospace-rtos/drivers/imu',
    ticketMarkdown: `### 🚨 Firmware Bug: Gyroscope & Accelerometer Telemetry Inverted

Telemetry downlink shows erratic readings and positive overflow when the drone tilts in the negative axis direction.

**Root Cause:** In \`imu_driver.c\`, \`imu_parse_axis\` unpacks 16-bit register bytes using little-endian \`(lsb << 8) | msb\` instead of the sensor's big-endian wire format \`(msb << 8) | lsb\`. Furthermore, it performs unsigned bit shifts without casting to signed \`int16_t\`, converting negative values (e.g. -200) into huge positive numbers (e.g. 65336).

**Fix Required:** 
1. Reconstruct the 16-bit word as big-endian: \`((uint16_t)msb << 8) | (uint16_t)lsb\`.
2. Properly cast the result to signed \`int16_t\` to preserve two's complement sign extension.`,
    entrypoint: 'test_runner.c',
    totalTests: 3,
    files: [
      {
        name: 'imu_driver.h',
        readOnly: true,
        content: `#ifndef IMU_DRIVER_H
#define IMU_DRIVER_H

#include <stdint.h>
#include <stdbool.h>

typedef struct {
    int16_t accel_x;
    int16_t accel_y;
    int16_t accel_z;
} imu_sample_t;

int16_t imu_parse_axis(uint8_t msb, uint8_t lsb);
bool imu_decode_packet(const uint8_t *raw_6byte_packet, imu_sample_t *out);

#endif`
      },
      {
        name: 'imu_driver.c',
        readOnly: false,
        content: `#include "imu_driver.h"

int16_t imu_parse_axis(uint8_t msb, uint8_t lsb) {
    // BUG: Reversed byte order (little-endian instead of big-endian)
    // BUG: Unsigned representation drops two's complement sign
    uint16_t raw = (lsb << 8) | msb;
    return (int16_t)raw;
}

bool imu_decode_packet(const uint8_t *raw_6byte_packet, imu_sample_t *out) {
    if (!raw_6byte_packet || !out) return false;
    out->accel_x = imu_parse_axis(raw_6byte_packet[0], raw_6byte_packet[1]);
    out->accel_y = imu_parse_axis(raw_6byte_packet[2], raw_6byte_packet[3]);
    out->accel_z = imu_parse_axis(raw_6byte_packet[4], raw_6byte_packet[5]);
    return true;
}`
      },
      {
        name: 'test_runner.c',
        readOnly: true,
        content: `#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include "imu_driver.h"
#include "imu_driver.c"

int main() {
    int passed = 0;

    // Test 1: Positive acceleration decoding (MSB: 0x01, LSB: 0xF4 -> 500)
    int16_t val1 = imu_parse_axis(0x01, 0xF4);
    if (val1 == 500) {
        printf("[PASS] TEST_1: Positive axis big-endian decoding\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_1: Expected 500, got %d\\n", val1);
    }

    // Test 2: Negative acceleration two's complement (-500 = 0xFE0C: MSB: 0xFE, LSB: 0x0C)
    int16_t val2 = imu_parse_axis(0xFE, 0x0C);
    if (val2 == -500) {
        printf("[PASS] TEST_2: Negative axis sign-extension\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_2: Expected -500, got %d\\n", val2);
    }

    // Test 3: Full packet decode with zero-crossing
    uint8_t packet[6] = {
        0x00, 0x00,  // X: 0
        0xFF, 0xFF,  // Y: -1
        0x04, 0x00   // Z: 1024
    };
    imu_sample_t sample;
    if (imu_decode_packet(packet, &sample) &&
        sample.accel_x == 0 &&
        sample.accel_y == -1 &&
        sample.accel_z == 1024) {
        printf("[PASS] TEST_3: Full packet decode integrity\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_3: Packet decode corrupted\\n");
    }

    printf("SUMMARY: %d/3 PASSED\\n", passed);
    return (passed == 3) ? 0 : 1;
}`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: EMBEDDED_SYSTEMS — PWM Timer Prescaler
  // ═══════════════════════════════════════════════════════════════════════════

  'embedded-pwm-prescaler': {
    id: 'embedded-pwm-prescaler',
    track: 'EMBEDDED_SYSTEMS',
    language: 'c',
    title: 'Bug #88: Motor RPM Oscillation from Timer Prescaler Off-by-One',
    repoContext: 'bldc-firmware/hal/pwm',
    ticketMarkdown: `### 🚨 Hardware Motor Alert: High-Frequency PWM Commutation Noise

BLDC motor controller emits high-pitched whine and vibrates violently due to PWM frequency deviating from target 20 kHz.

**Root Cause:** In \`pwm_timer.c\`, the prescaler calculation uses \`(clk / (target_freq * arr))\` instead of the ARM Cortex-M hardware register formula \`(clk / (target_freq * (arr + 1))) - 1\`. Furthermore, \`pwm_duty_to_ccr\` does not clamp duty cycle percentages above 100%, causing register overflow.

**Fix Required:** 
1. Use the exact hardware formula: \`(uint16_t)((timer_clk_hz / (target_freq_hz * (arr + 1))) - 1)\`.
2. Clamp \`duty_percent\` to a maximum of 100 before computing \`(duty * arr) / 100\`.`,
    entrypoint: 'test_runner.c',
    totalTests: 3,
    files: [
      {
        name: 'pwm_timer.h',
        readOnly: true,
        content: `#ifndef PWM_TIMER_H
#define PWM_TIMER_H

#include <stdint.h>
#include <stdbool.h>

uint16_t pwm_calculate_prescaler(uint32_t timer_clk_hz, uint32_t target_freq_hz, uint16_t arr);
uint16_t pwm_duty_to_ccr(uint8_t duty_percent, uint16_t arr);

#endif`
      },
      {
        name: 'pwm_timer.c',
        readOnly: false,
        content: `#include "pwm_timer.h"

uint16_t pwm_calculate_prescaler(uint32_t timer_clk_hz, uint32_t target_freq_hz, uint16_t arr) {
    if (target_freq_hz == 0 || arr == 0) return 0;
    // BUG: Missing (arr + 1) and missing - 1 register offset
    uint32_t div = timer_clk_hz / (target_freq_hz * arr);
    return (uint16_t)div;
}

uint16_t pwm_duty_to_ccr(uint8_t duty_percent, uint16_t arr) {
    // BUG: Does not clamp duty_percent > 100
    return (uint16_t)(((uint32_t)duty_percent * arr) / 100);
}`
      },
      {
        name: 'test_runner.c',
        readOnly: true,
        content: `#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include "pwm_timer.h"
#include "pwm_timer.c"

int main() {
    int passed = 0;

    // Test 1: Standard 84MHz timer with 20kHz target and ARR=999
    // Formula: 84,000,000 / (20,000 * (999 + 1)) - 1 = 84,000,000 / 20,000,000 - 1 = 4 - 1 = 3
    uint16_t psc = pwm_calculate_prescaler(84000000, 20000, 999);
    if (psc == 3) {
        printf("[PASS] TEST_1: Hardware prescaler register formula\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_1: Expected PSC=3, got %u\\n", psc);
    }

    // Test 2: 50% duty cycle on ARR=1000 yields CCR=500
    uint16_t ccr = pwm_duty_to_ccr(50, 1000);
    if (ccr == 500) {
        printf("[PASS] TEST_2: Standard 50%% duty cycle conversion\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_2: Expected CCR=500, got %u\\n", ccr);
    }

    // Test 3: Duty cycle clamping above 100%
    uint16_t clamped_ccr = pwm_duty_to_ccr(150, 1000);
    if (clamped_ccr == 1000) {
        printf("[PASS] TEST_3: Duty cycle clamped at 100%% max\\n");
        passed++;
    } else {
        printf("[FAIL] TEST_3: Failed to clamp duty cycle, got %u\\n", clamped_ccr);
    }

    printf("SUMMARY: %d/3 PASSED\\n", passed);
    return (passed == 3) ? 0 : 1;
}`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: PRODUCTION_SWE — Python Async Stream Worker Connection Leak
  // ═══════════════════════════════════════════════════════════════════════════

  'swe-async-worker-leak': {
    id: 'swe-async-worker-leak',
    track: 'PRODUCTION_SWE',
    language: 'python',
    title: 'PR #73: Fix Connection Starvation & Missing Cleanup in Async Stream Consumer',
    repoContext: 'fast-stream/worker-queue',
    ticketMarkdown: `### 🚨 Production Alert: Python Async Worker OOM & Hanging Connections

Worker nodes running high-throughput stream consumer pods encounter connection pool exhaustion after catching payload validation exceptions.

**Root Cause:** In \`stream_worker.py\`, \`process_batch\` creates a connection handle for the batch. If any record raises a processing error, the exception escapes without closing the connection (\`conn.close()\`), leaving the socket handle hanging in the active pool.

**Fix Required:** Wrap the batch iteration in a \`try...finally\` block to ensure \`conn.close()\` is unconditionally called even when an exception is raised or handled.`,
    entrypoint: 'test_runner.py',
    totalTests: 3,
    files: [
      {
        name: 'types_def.py',
        readOnly: true,
        content: `class MockConnection:
    def __init__(self, conn_id: int):
        self.conn_id = conn_id
        self.is_closed = False

    def close(self):
        self.is_closed = True

class ConnectionTracker:
    def __init__(self):
        self.active_connections = set()

    def create_conn(self, conn_id: int) -> MockConnection:
        conn = MockConnection(conn_id)
        self.active_connections.add(conn)
        return conn

    def get_open_count(self) -> int:
        return sum(1 for c in self.active_connections if not c.is_closed)`
      },
      {
        name: 'stream_worker.py',
        readOnly: false,
        content: `from types_def import ConnectionTracker, MockConnection

def process_batch(tracker: ConnectionTracker, batch_id: int, records: list) -> int:
    conn = tracker.create_conn(batch_id)
    processed = 0

    # BUG: Missing try/finally block around record processing.
    # If a record causes ValueError, conn.close() is never reached!
    for r in records:
        if r < 0:
            raise ValueError(f"Negative record {r} rejected")
        processed += r

    conn.close()
    return processed`
      },
      {
        name: 'test_runner.py',
        readOnly: true,
        content: `import sys
from types_def import ConnectionTracker
from stream_worker import process_batch

passed = 0
tracker = ConnectionTracker()

# Test 1: Normal processing closes connection
try:
    total = process_batch(tracker, 101, [1, 2, 3, 4])
    if total == 10 and tracker.get_open_count() == 0:
        print("[PASS] TEST_1: Normal batch closes connection")
        passed += 1
    else:
        print(f"[FAIL] TEST_1: Open connections remaining: {tracker.get_open_count()}")
except Exception as e:
    print(f"[FAIL] TEST_1: Unexpected error: {e}")

# Test 2: Error path must also close connection
try:
    process_batch(tracker, 102, [5, -1, 10])
    print("[FAIL] TEST_2: Expected ValueError was not raised")
except ValueError:
    if tracker.get_open_count() == 0:
        print("[PASS] TEST_2: Error path unconditionally closes connection via finally")
        passed += 1
    else:
        print(f"[FAIL] TEST_2: Connection leaked on error path: {tracker.get_open_count()}")
except Exception as e:
    print(f"[FAIL] TEST_2: Wrong exception type: {e}")

# Test 3: Burst of mixed batches maintains zero leaked connections
for i in range(10):
    try:
        process_batch(tracker, 200 + i, [i, -1 if i % 2 == 0 else i * 2])
    except ValueError:
        pass

if tracker.get_open_count() == 0:
    print("[PASS] TEST_3: High-frequency bursts maintain zero leaked handles")
    passed += 1
else:
    print(f"[FAIL] TEST_3: Total leaked handles: {tracker.get_open_count()}")

print(f"SUMMARY: {passed}/3 PASSED")
if passed == 3:
    sys.exit(0)
else:
    sys.exit(1)`
      }
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Lookup Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/** Get a challenge by its ID. Returns undefined if not found. */
export function getChallengeById(id: string): Challenge | undefined {
  return SEED_CHALLENGES[id];
}

/** Get a random challenge, optionally filtered by track. */
export function getRandomChallenge(track?: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS'): Challenge {
  const all = Object.values(SEED_CHALLENGES);
  const pool = track ? all.filter((c) => c.track === track) : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Get all challenge IDs. */
export function getAllChallengeIds(): string[] {
  return Object.keys(SEED_CHALLENGES);
}

/** Get all challenges as an array, optionally filtered by track. */
export function getAllChallenges(track?: 'PRODUCTION_SWE' | 'EMBEDDED_SYSTEMS'): Challenge[] {
  const all = Object.values(SEED_CHALLENGES);
  return track ? all.filter((c) => c.track === track) : all;
}
