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
  language: 'typescript' | 'c';
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
