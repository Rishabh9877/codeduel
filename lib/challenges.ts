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

export interface ChallengeWalkthrough {
  rootCause: string;
  buggyVsFixedDiff: string;
  whyItMatters: string;
  commonMistakes: string[];
}

export interface HardwareRegister {
  address: string;
  name: string;
  value: string;
  desc: string;
}

export interface MemoryRegion {
  region: string;
  start: string;
  end: string;
  desc: string;
}

export interface HardwareContext {
  mcu: string;
  clockSpeed: string;
  busProtocol: string;
  observedFailure: string;
  registers: HardwareRegister[];
  waveformSvg?: string;
  memoryMap: MemoryRegion[];
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
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  skills: string[];
  walkthrough: ChallengeWalkthrough;
  hardwareContext?: HardwareContext;
  hiddenTestsCount?: number;
}

export const SEED_CHALLENGES: Record<string, Challenge> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: PRODUCTION_SWE — TypeScript / Node.js Microservice Bugs
  // ═══════════════════════════════════════════════════════════════════════════

  'swe-token-bucket': {
    difficulty: 'medium',
    estimatedMinutes: 15,
    skills: ["Rate Limiting","Token Bucket","Time Truncation","Concurrency"],
    walkthrough: {
      "rootCause": "In rateLimiter.ts, elapsed time is computed as Math.floor((now - lastRefillMs) / 1000). For any sub-second intervals (< 1000ms), this integer truncation evaluates to 0, completely preventing token replenishment during high-frequency microsecond/millisecond bursts.",
      "buggyVsFixedDiff": "- const elapsedSeconds = Math.floor((now - this.state.lastRefillMs) / 1000);\n+ const elapsedSeconds = (now - this.state.lastRefillMs) / 1000;\n+ if (elapsedSeconds > 0) {\n+   this.state.tokens = Math.min(this.config.maxCapacity, this.state.tokens + elapsedSeconds * this.config.refillRatePerSec);\n+   this.state.lastRefillMs = now;\n+ }",
      "whyItMatters": "High-throughput cloud APIs and edge proxies process hundreds of requests per second. Truncating milliseconds causes severe false-positive rate limit penalties (HTTP 429) for legitimate burst traffic.",
      "commonMistakes": [
            "Truncating sub-second intervals to 0 with Math.floor instead of float division",
            "Forgetting to clamp the replenished tokens to maxCapacity with Math.min",
            "Updating lastRefillMs before computing the elapsed delta"
      ]
},

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
    hiddenTestsCount: 1,
    hardwareContext: {
      mcu: "STM32F401RE (ARM Cortex-M4 @ 84MHz)",
      clockSpeed: "84 MHz",
      busProtocol: "USART2 @ 115200 Baud 8N1",
      observedFailure: "Ring buffer overflows and halts UART telemetry after 32 bytes without modulo capacity wrap-around.",
      registers: [
        { address: "0x40004400", name: "USART2_SR", value: "0x000000E0", desc: "TXE=1, RXNE=1, ORE=1 (Overrun Error detected)" },
        { address: "0x40004404", name: "USART2_DR", value: "0x00000055", desc: "Data Register (last received byte)" },
        { address: "0x40004408", name: "USART2_BRR", value: "0x000002D9", desc: "Baud rate register (115200 @ 84MHz APB1)" },
        { address: "0x4000440C", name: "USART2_CR1", value: "0x0000202C", desc: "UE=1, TE=1, RE=1, RXNEIE=1" }
      ],
      memoryMap: [
        { region: "Flash ROM", start: "0x08000000", end: "0x0807FFFF", desc: "512 KB User Code & ISR vectors" },
        { region: "SRAM", start: "0x20000000", end: "0x20017FFF", desc: "96 KB Ring Buffer Heap/Stack" },
        { region: "Peripherals", start: "0x40000000", end: "0x40023FFF", desc: "USART2, DMA1, NVIC mapped I/O" }
      ],
      waveformSvg: "uart-overflow"
    },
    difficulty: 'medium',
    estimatedMinutes: 15,
    skills: ["Circular Buffer","Pointer Arithmetic","UART Telemetry","Embedded Drivers"],
    walkthrough: {
      "rootCause": "In ring_buffer.c, rb_is_full incorrectly used (rb->head == rb->tail), which collided with the rb_is_empty condition. Additionally, the enqueue function failed to wrap the head pointer using modulo buffer capacity, causing memory writes outside allocated bounds.",
      "buggyVsFixedDiff": "- bool rb_is_full(const ring_buffer_t *rb) { return rb->head == rb->tail; }\n+ bool rb_is_full(const ring_buffer_t *rb) { return ((rb->head + 1) % rb->capacity) == rb->tail; }\n+ bool rb_enqueue(ring_buffer_t *rb, uint8_t byte) {\n+   if (rb_is_full(rb)) return false;\n+   rb->buffer[rb->head] = byte;\n+   rb->head = (rb->head + 1) % rb->capacity;\n+   return true;\n+ }",
      "whyItMatters": "Ring buffers are the foundational FIFO structure for serial UART, SPI, and CAN bus interrupt service routines (ISRs). Pointer desynchronization corrupts telemetry packets or locks hardware into fault loops.",
      "commonMistakes": [
            "Colliding full and empty states when head == tail without a capacity offset",
            "Advancing the pointer linearly without modulo capacity wrapping",
            "Writing to buffer before verifying if the queue is already full"
      ]
},

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
    difficulty: 'easy',
    estimatedMinutes: 10,
    skills: ["Exponential Backoff","Jitter","Network Resilience","Microservices"],
    walkthrough: {
      "rootCause": "In retry.ts, the full-jitter offset calculation subtracted a random number that could yield negative delay values, triggering instantaneous retries that violated minimum backoff and stampeded upstream services.",
      "buggyVsFixedDiff": "- const jitter = Math.random() * -100;\n- const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt) + jitter);\n+ const rawDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));\n+ const delay = Math.floor(Math.random() * rawDelay); // Full jitter: random [0, rawDelay]",
      "whyItMatters": "In distributed microservice networks, without proper non-negative backoff and random jitter, retrying clients synchronize their spikes and cause catastrophic cascading retry storms (the thundering herd problem).",
      "commonMistakes": [
            "Subtracting unbounded negative jitter offsets",
            "Failing to clamp exponential growth with maxDelay",
            "Off-by-one errors starting attempt count from 1 instead of 0"
      ]
},

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
    hiddenTestsCount: 1,
    hardwareContext: {
      mcu: "Nordic nRF52840 (ARM Cortex-M4F @ 64MHz)",
      clockSpeed: "64 MHz",
      busProtocol: "GPIOTE / GPIO Interrupt (Active Low)",
      observedFailure: "Physical mechanical switch bounce generates 8-12 spurious rising edges within 3ms, corrupting state machine transitions.",
      registers: [
        { address: "0x50000500", name: "P0_IN", value: "0x00000004", desc: "Pin 2 button state (floating/bouncing)" },
        { address: "0x40006000", name: "GPIOTE_INTENSET", value: "0x00000001", desc: "Channel 0 event interrupt enabled" },
        { address: "0x40006510", name: "GPIOTE_CONFIG[0]", value: "0x00020201", desc: "Mode=Event, Polar=HiToLo, Pin=2" },
        { address: "0x40008000", name: "RTC0_COUNTER", value: "0x00001A4F", desc: "32.768 kHz low-power timer ticks" }
      ],
      memoryMap: [
        { region: "Flash", start: "0x00000000", end: "0x000FFFFF", desc: "1 MB Flash (SoftDevice + Application)" },
        { region: "RAM", start: "0x20000000", end: "0x2003FFFF", desc: "256 KB Data RAM" },
        { region: "Peripherals", start: "0x40000000", end: "0x5003FFFF", desc: "GPIO, GPIOTE, RTC0 mapped I/O" }
      ],
      waveformSvg: "gpio-bounce"
    },
    difficulty: 'medium',
    estimatedMinutes: 15,
    skills: ["GPIO","Debouncing","Interrupts","Bitmasking"],
    walkthrough: {
      "rootCause": "In debounce.c, the history state was shifted using a signed 32-bit integer without proper masking, causing sign extension to corrupt previous samples and toggle output on transient contact noise.",
      "buggyVsFixedDiff": "- state->history = (state->history << 1) | raw_sample;\n- if (state->history > 0x0F) state->stable_state = 1;\n+ state->history = ((state->history << 1) | (raw_sample & 0x01)) & 0xFF;\n+ if (state->history == 0xFF) state->stable_state = 1;\n+ else if (state->history == 0x00) state->stable_state = 0;",
      "whyItMatters": "Mechanical switches and push-buttons bounce for 5–20 milliseconds upon closing. Without deterministic digital debouncing, a single human button press registers as dozens of spurious trigger events in industrial controllers.",
      "commonMistakes": [
            "Allowing sign bit propagation in signed integer shift operations",
            "Toggling state on partial thresholds rather than steady-state mask equality",
            "Ignoring the release transition debounce condition (checking only press)"
      ]
},

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
    difficulty: 'hard',
    estimatedMinutes: 20,
    skills: ["JWT Security","Cryptographic Verification","Algorithm Confusion","Auth"],
    walkthrough: {
      "rootCause": "In jwtValidator.ts, the verification logic inspected the token header's 'alg' property and dynamically used HMAC verification if alg was 'HS256', allowing attackers to sign tokens with the server's public RSA key treated as an HMAC secret key.",
      "buggyVsFixedDiff": "- if (header.alg === 'HS256') { verifyHmac(token, serverPublicKey); }\n+ if (header.alg !== 'RS256') {\n+   throw new Error(\"Invalid algorithm: only RS256 asymmetric signatures permitted\");\n+ }\n+ verifyRsa(token, serverPublicKey);",
      "whyItMatters": "Algorithm confusion is a critical authentication vulnerability (CVE-2015-9235 pattern) that allows complete privilege escalation and administrative token forgery using publicly visible public keys.",
      "commonMistakes": [
            "Trusting the user-supplied header alg instead of pinning expected server algorithm",
            "Allowing symmetric HMAC fallbacks for asymmetric RSA public keys",
            "Accepting the 'none' algorithm token bypass"
      ]
},

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
    difficulty: 'medium',
    estimatedMinutes: 15,
    skills: ["Database Connection Pool","Resource Management","Exception Handling","PostgreSQL"],
    walkthrough: {
      "rootCause": "In pool.ts, database connections checked out from the pool were only returned in the happy path of the query function. When an asynchronous query threw a SQL exception, the release call was bypassed, permanently leaking active pool slots.",
      "buggyVsFixedDiff": "- const client = await pool.acquire();\n- const result = await client.query(sql);\n- pool.release(client);\n- return result;\n+ const client = await pool.acquire();\n+ try {\n+   return await client.query(sql);\n+ } finally {\n+   pool.release(client);\n+ }",
      "whyItMatters": "Connection pools have finite maximum capacities (typically 10–50 connections). Any unhandled exception that bypasses release will exhaust all pool slots within minutes, bringing down all backend database operations.",
      "commonMistakes": [
            "Placing cleanup logic after potential throw points without a try/finally block",
            "Closing the entire connection instead of returning it to the pool",
            "Catching errors without re-throwing, concealing database failures from callers"
      ]
},

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
    difficulty: 'hard',
    estimatedMinutes: 20,
    skills: ["Caching","Distributed Mutex","Cache Stampede","Concurrency"],
    walkthrough: {
      "rootCause": "In cache.ts, when a key expired, the mutex lock acquisition was attempted without a release guarantee inside a finally block. If upstream database regeneration failed, the mutex remained locked forever, deadlocking subsequent requests.",
      "buggyVsFixedDiff": "- if (!cached) {\n-   await lock.acquire(key);\n-   const fresh = await fetchUpstream(key);\n-   cache.set(key, fresh);\n-   await lock.release(key);\n- }\n+ if (!cached) {\n+   await lock.acquire(key);\n+   try {\n+     const doubleCheck = cache.get(key);\n+     if (doubleCheck) return doubleCheck;\n+     const fresh = await fetchUpstream(key);\n+     cache.set(key, fresh, ttl);\n+     return fresh;\n+   } finally {\n+     await lock.release(key);\n+   }\n+ }",
      "whyItMatters": "Cache stampedes (dogpiling) occur when high-traffic cache keys expire. Without an atomic mutex and double-checked caching, thousands of concurrent requests slam the primary database at once.",
      "commonMistakes": [
            "Failing to release the mutex lock inside a finally block on upstream failure",
            "Missing double-check of cache value after acquiring the lock",
            "Setting zero TTL causing immediate re-invalidation"
      ]
},

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
    hiddenTestsCount: 1,
    hardwareContext: {
      mcu: "ST LSM6DS3 on STM32G431KB (Cortex-M4 @ 170MHz)",
      clockSpeed: "170 MHz Core / 10 MHz SPI Clock",
      busProtocol: "SPI1 Mode 3 (CPOL=1, CPHA=1)",
      observedFailure: "Z-axis accelerometer telemetry reads +16384G impact instead of 1G resting gravity due to swapped MSB/LSB byte pairing.",
      registers: [
        { address: "0x40013000", name: "SPI1_CR1", value: "0x00000354", desc: "SPE=1, MSTR=1, BR=16, CPOL=1, CPHA=1" },
        { address: "0x40013008", name: "SPI1_SR", value: "0x00000003", desc: "RXNE=1, TXE=1, BSY=0" },
        { address: "0x4001300C", name: "SPI1_DR", value: "0x000000FA", desc: "Data register (raw low byte received)" },
        { address: "0x00000028", name: "LSM6_OUTX_L_XL", value: "0x000000A0", desc: "Sensor internal register: X low byte" }
      ],
      memoryMap: [
        { region: "Flash", start: "0x08000000", end: "0x0801FFFF", desc: "128 KB Dual-bank Flash" },
        { region: "SRAM", start: "0x20000000", end: "0x20007FFF", desc: "32 KB SRAM" },
        { region: "APB2 Bus", start: "0x40013000", end: "0x400133FF", desc: "SPI1 hardware controller" }
      ],
      waveformSvg: "spi-endian"
    },
    difficulty: 'medium',
    estimatedMinutes: 15,
    skills: ["SPI Bus","Endianness","Sensor Drivers","Bit Manipulation"],
    walkthrough: {
      "rootCause": "In spi_packet.c, 16-bit accelerometer register readings were parsed assuming MSB byte first (big-endian), whereas the peripheral sensor transmitted LSB byte first (little-endian), resulting in reversed byte alignment and erroneous acceleration values.",
      "buggyVsFixedDiff": "- int16_t accel_x = ((int16_t)rx_buf[0] << 8) | rx_buf[1];\n+ int16_t accel_x = ((int16_t)rx_buf[1] << 8) | rx_buf[0];",
      "whyItMatters": "Hardware peripherals (IMUs, flash chips, ADCs) communicate across SPI buses with specific hardware byte orders. Swapping endianness turns valid sensor readings into wild noise, compromising attitude estimation and drone stability.",
      "commonMistakes": [
            "Reversing MSB and LSB byte indexing",
            "Shifting an unsigned byte without casting to 16-bit signed integer first",
            "Sign extension corruption when combining bytes"
      ]
},

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
    difficulty: 'easy',
    estimatedMinutes: 10,
    skills: ["PWM","Timer Prescaler","Duty Cycle","Embedded Hardware"],
    walkthrough: {
      "rootCause": "In pwm_timer.c, the timer frequency prescaler calculation divided the input clock by prescaler directly without adding 1 (standard microcontroller hardware formula is timer_clk / (prescaler + 1)), causing a divide-by-zero HardFault whenever prescaler was 0.",
      "buggyVsFixedDiff": "- uint32_t timer_freq = clock_source_hz / config->prescaler;\n+ uint32_t timer_freq = clock_source_hz / (config->prescaler + 1);\n+ if (config->duty_percent > 100) config->duty_percent = 100;",
      "whyItMatters": "Motor speed controllers, servos, and switching regulators depend on precise PWM frequencies. A division by zero triggers ARM Cortex-M HardFault exception, causing the MCU to hang or reboot.",
      "commonMistakes": [
            "Dividing by prescaler directly without the +1 hardware offset",
            "Failing to clamp duty cycle percentages to 100%",
            "Timer period overflow from incorrect frequency division"
      ]
},

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
    difficulty: 'medium',
    estimatedMinutes: 15,
    skills: ["Python AsyncIO","Event Loop","Non-blocking I/O","Worker Queues"],
    walkthrough: {
      "rootCause": "In worker.py, the worker coroutine called the blocking time.sleep() function inside an async task loop instead of asyncio.sleep(), halting the single-threaded Python event loop and freezing all concurrent workers.",
      "buggyVsFixedDiff": "- import time\n- async def process_job(job):\n-     time.sleep(job.duration) # BLOCKING! Freezes the entire event loop\n+ import asyncio\n+ async def process_job(job):\n+     await asyncio.sleep(job.duration) # Non-blocking asynchronous yield",
      "whyItMatters": "Asynchronous frameworks (FastAPI, asyncio, Node.js) rely on cooperative multitasking. Invoking a synchronous blocking call stops the event loop from scheduling other tasks, dropping concurrency throughput to zero.",
      "commonMistakes": [
            "Using synchronous time.sleep() instead of await asyncio.sleep()",
            "Calling blocking I/O methods inside coroutines without run_in_executor",
            "Forgetting the await keyword in front of coroutines"
      ]
},

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

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: EMBEDDED_SYSTEMS — Volatile Desynchronization & Telemetry ISR Race
  // ═══════════════════════════════════════════════════════════════════════════

  'embedded-interrupt-race': {
    hiddenTestsCount: 1,
    hardwareContext: {
      mcu: 'STM32F401RE (ARM Cortex-M4 @ 84MHz)',
      clockSpeed: '84 MHz APB1 Core',
      busProtocol: 'NVIC USART2 Telemetry ISR Handler',
      observedFailure: 'Main polling loop hangs indefinitely waiting for packet counter update because compiler -O2 caches packet_count in CPU register r3.',
      registers: [
        { address: '0xE000E100', name: 'NVIC_ISER0', value: '0x00000040', desc: 'Interrupt Set-Enable Register (USART2 IRQ enabled)' },
        { address: '0xE000E200', name: 'NVIC_ISPR0', value: '0x00000000', desc: 'Interrupt Pending Register' },
        { address: '0x40004400', name: 'USART2_SR',  value: '0x00000020', desc: 'RXNE=1 (Received byte ready in DR)' },
        { address: '0xE000ED04', name: 'SCB_ICSR',   value: '0x00400000', desc: 'Interrupt Control and State Register' }
      ],
      memoryMap: [
        { region: 'Flash', start: '0x08000000', end: '0x0807FFFF', desc: '512 KB Flash (Vector Table at 0x08000000)' },
        { region: 'SRAM',  start: '0x20000000', end: '0x20017FFF', desc: '96 KB SRAM (Static packet_count @ 0x20000100)' },
        { region: 'PPB',   start: '0xE0000000', end: '0xE00FFFFF', desc: 'Private Peripheral Bus (NVIC, SysTick, SCB)' }
      ],
      waveformSvg: 'interrupt-race'
    },
    difficulty: 'hard',
    estimatedMinutes: 20,
    skills: ['Interrupt Service Routine', 'Volatile Keyword', 'Atomic Sections', 'ARM Cortex-M4'],
    walkthrough: {
      rootCause: 'packet_count was missing the volatile qualifier. Under -O2 optimization, the compiler assumes memory does not change asynchronously and caches the initial value in a CPU register, creating an infinite loop. Additionally, reading 64-bit timestamps without masking PRIMASK causes torn reads if interrupted mid-word.',
      buggyVsFixedDiff: '- static uint32_t packet_count = 0;\n+ static volatile uint32_t packet_count = 0;\n\n- stats.last_timestamp_us = last_timestamp_us;\n+ uint32_t primask = __get_PRIMASK();\n+ __disable_irq();\n+ stats.last_timestamp_us = last_timestamp_us;\n+ if (!primask) __enable_irq();',
      whyItMatters: 'On real microcontrollers, the optimizer assumes single-threaded execution unless variables touched by ISRs are explicitly marked volatile. Omitting volatile causes watchdog resets and system hangs in safety-critical firmware.',
      commonMistakes: [
        'Omitting volatile keyword on variables modified inside an ISR',
        'Failing to preserve and restore PRIMASK when disabling interrupts',
        'Performing non-atomic reads of multi-byte 64-bit variables shared with interrupts'
      ]
    },
    id: 'embedded-interrupt-race',
    track: 'EMBEDDED_SYSTEMS',
    language: 'c',
    title: 'PR #42: Fix Volatile Desynchronization & Race Condition in Telemetry ISR',
    repoContext: 'zephyr-rtos/uart-telemetry-isr',
    ticketMarkdown: `### Incident #42: Telemetry Watchdog Fault under High-Frequency UART Bursts

**Severity:** P1 Blocker  
**Target Board:** STM32F401RE (ARM Cortex-M4 @ 84MHz)  
**Component:** \`telemetry_driver.c\` (Zephyr RTOS UART Driver)

#### Description
When telemetry packets stream at high data rates (> 1 kHz), the main system loop in \`telemetry_wait_for_packets()\` frequently fails to observe packet count increments and trips the hardware watchdog timer (WDT).
Disassembly analysis reveals that GCC/Clang with \`-O2\` optimization hoists the read of \`packet_count\` out of the loop into register \`r3\`, never re-fetching the updated value from SRAM after the ISR triggers!

Furthermore, atomic snapshots in \`telemetry_get_stats_atomic()\` occasionally yield corrupted 64-bit timestamps due to torn reads when the ISR fires between reading the upper and lower 32-bit words.

#### Acceptance Criteria
1. Mark shared ISR variables as \`volatile\` so the compiler emits an \`LDR\` instruction on every iteration.
2. Protect multi-word timestamp reads inside a critical section that saves and restores the \`PRIMASK\` state.
3. Pass all 3 unit tests without triggering watchdog timeouts.`,
    entrypoint: 'test_runner.c',
    totalTests: 3,
    files: [
      {
        name: 'registers.h',
        readOnly: true,
        content: `#ifndef REGISTERS_H
#define REGISTERS_H
#include <stdint.h>
#include <stdbool.h>

extern volatile uint32_t simulated_primask;

static inline void __disable_irq(void) { simulated_primask = 1; }
static inline void __enable_irq(void)  { simulated_primask = 0; }
static inline uint32_t __get_PRIMASK(void) { return simulated_primask; }

#endif`
      },
      {
        name: 'telemetry.h',
        readOnly: true,
        content: `#ifndef TELEMETRY_H
#define TELEMETRY_H
#include <stdint.h>
#include <stdbool.h>

typedef struct {
  uint32_t packet_count;
  uint32_t dropped_packets;
  uint64_t last_timestamp_us;
  bool isr_active;
} telemetry_stats_t;

void telemetry_init(void);
void telemetry_isr_handler(uint64_t timestamp_us);
telemetry_stats_t telemetry_get_stats_atomic(void);
bool telemetry_wait_for_packets(uint32_t target_count, uint32_t timeout_loops);

#endif`
      },
      {
        name: 'telemetry.c',
        readOnly: false,
        content: `#include "telemetry.h"
#include "registers.h"
#include <string.h>

// BUG: Missing volatile keyword! Compiler hoists variable into register at -O2.
static uint32_t packet_count = 0;
static uint32_t dropped_packets = 0;
static uint64_t last_timestamp_us = 0;
static bool isr_active = false;

void telemetry_init(void) {
  packet_count = 0;
  dropped_packets = 0;
  last_timestamp_us = 0;
  isr_active = false;
}

void telemetry_isr_handler(uint64_t timestamp_us) {
  isr_active = true;
  packet_count++;
  last_timestamp_us = timestamp_us;
  isr_active = false;
}

telemetry_stats_t telemetry_get_stats_atomic(void) {
  telemetry_stats_t stats;
  // BUG: Does not disable interrupts! 64-bit timestamp is subject to torn reads.
  stats.packet_count = packet_count;
  stats.dropped_packets = dropped_packets;
  stats.last_timestamp_us = last_timestamp_us;
  stats.isr_active = isr_active;
  return stats;
}

bool telemetry_wait_for_packets(uint32_t target_count, uint32_t timeout_loops) {
  uint32_t loops = 0;
  while (packet_count < target_count) {
    loops++;
    if (loops > timeout_loops) {
      return false; // Watchdog timeout
    }
  }
  return true;
}`
      },
      {
        name: 'test_runner.c',
        readOnly: true,
        content: `#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include "telemetry.h"
#include "registers.h"

volatile uint32_t simulated_primask = 0;

int main(void) {
  int passed = 0;
  const int total = 3;

  // Test 1: Basic ISR increments and atomic snapshot
  telemetry_init();
  telemetry_isr_handler(1000);
  telemetry_isr_handler(2000);
  telemetry_stats_t s1 = telemetry_get_stats_atomic();
  if (s1.packet_count == 2 && s1.last_timestamp_us == 2000) {
    printf("[PASS] test_isr_increment_and_atomic_snapshot\\n");
    passed++;
  } else {
    printf("[FAIL] test_isr_increment_and_atomic_snapshot (got count=%u, ts=%llu)\\n", s1.packet_count, (unsigned long long)s1.last_timestamp_us);
  }

  // Test 2: Polling loop without register caching
  telemetry_init();
  for (uint32_t i = 1; i <= 5; i++) {
    telemetry_isr_handler(i * 500);
  }
  bool polled = telemetry_wait_for_packets(5, 1000);
  if (polled) {
    printf("[PASS] test_volatile_polling_loop\\n");
    passed++;
  } else {
    printf("[FAIL] test_volatile_polling_loop (timed out reading packet_count)\\n");
  }

  // Test 3 (Hidden Edge Case): Atomic PRIMASK preservation during nested calls
  telemetry_init();
  __disable_irq();
  telemetry_stats_t s2 = telemetry_get_stats_atomic();
  bool primask_preserved = (__get_PRIMASK() == 1);
  __enable_irq();
  if (primask_preserved && s2.packet_count == 0) {
    printf("[PASS] test_nested_critical_section_preservation\\n");
    passed++;
  } else {
    printf("[FAIL] test_nested_critical_section_preservation (PRIMASK was prematurely unmasked)\\n");
  }

  printf("SUMMARY: %d/%d PASSED\\n", passed, total);
  return (passed == total) ? 0 : 1;
}`
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRACK: EMBEDDED_SYSTEMS — Cortex-M0 Unaligned Memory Access HardFault
  // ═══════════════════════════════════════════════════════════════════════════

  'embedded-packed-alignment': {
    hiddenTestsCount: 1,
    hardwareContext: {
      mcu: 'NXP LPC1114 (ARM Cortex-M0 @ 48MHz)',
      clockSpeed: '48 MHz System Core',
      busProtocol: 'CAN Bus 2.0B Controller @ 500 kbps',
      observedFailure: 'ECU crashes into HardFault_Handler on byte offset 1 and 3 because ARM Cortex-M0 lacks hardware support for unaligned 16/32-bit word loads.',
      registers: [
        { address: '0xE000ED28', name: 'SCB_CFSR',  value: '0x01000000', desc: 'UNALIGN_TRP (Unaligned trap enabled)' },
        { address: '0xE000ED2C', name: 'SCB_HFSR',  value: '0x40000000', desc: 'FORCED (HardFault forced by unaligned bus error)' },
        { address: '0x40018000', name: 'CAN_MOD',   value: '0x00000000', desc: 'Operating Mode Register' },
        { address: '0x40018014', name: 'CAN_RFS',   value: '0x00080000', desc: 'Receive Frame Status (DLC=8 bytes)' }
      ],
      memoryMap: [
        { region: 'Flash', start: '0x00000000', end: '0x00007FFF', desc: '32 KB Flash memory' },
        { region: 'SRAM',  start: '0x10000000', end: '0x10001FFF', desc: '8 KB Fast Local SRAM' },
        { region: 'APB',   start: '0x40000000', end: '0x4005FFFF', desc: 'C_CAN, UART, SysTick Peripherals' }
      ],
      waveformSvg: 'can-alignment'
    },
    difficulty: 'medium',
    estimatedMinutes: 15,
    skills: ['Memory Alignment', 'Cortex-M0 HardFault', 'CAN Bus', 'Byte Extraction'],
    walkthrough: {
      rootCause: 'Directly dereferencing (uint16_t*)(buffer + 1) or (uint32_t*)(buffer + 3) causes unaligned memory access. While x86 and Cortex-M3/M4 have hardware fixup for unaligned loads, Cortex-M0 cores trigger a fatal HardFault exception. The solution is using memcpy or manual byte-shifting.',
      buggyVsFixedDiff: '- return *(uint16_t *)(buffer + offset);\n+ uint16_t result = 0;\n+ memcpy(&result, buffer + offset, sizeof(uint16_t));\n+ return result;',
      whyItMatters: 'Low-cost automotive and medical microcontrollers run Cortex-M0 or M0+ cores. Casting byte buffers directly to structs causes immediate runtime bricking in the field.',
      commonMistakes: [
        'Assuming all ARM processors handle unaligned word access',
        'Casting uint8_t* to uint32_t* directly instead of using memcpy or bit shifts',
        'Not validating DLC frame length before reading telemetry fields'
      ]
    },
    id: 'embedded-packed-alignment',
    track: 'EMBEDDED_SYSTEMS',
    language: 'c',
    title: 'PR #89: Prevent Cortex-M0 Unaligned Memory HardFault in CAN Packet Parser',
    repoContext: 'can-bus/obd2-frame-parser',
    ticketMarkdown: `### Incident #89: Cortex-M0 HardFault Exception in CAN OBD-II Parser

**Severity:** P1 Critical  
**Target Board:** NXP LPC1114 (ARM Cortex-M0 @ 48MHz)  
**Component:** \`can_parser.c\` (CAN Bus Telemetry Node)

#### Description
During vehicle test drives, the CAN gateway node periodically halts with an unhandled \`HardFault_Handler\` interrupt.
The crash occurs inside \`parse_uint16_safe()\` and \`parse_uint32_safe()\`.
Unlike Cortex-M3/M4, the ARM Cortex-M0 architecture **does not support unaligned memory access**. Dereferencing a 16-bit word pointer at an odd byte offset (e.g. \`offset = 1\`) or a 32-bit word pointer at non-multiple-of-4 address (e.g. \`offset = 3\`) generates an immediate bus fault.

#### Acceptance Criteria
1. Re-implement \`parse_uint16_safe()\` and \`parse_uint32_safe()\` using byte-safe extraction (e.g. \`memcpy\` or bitwise shifts) to avoid unaligned pointer dereferencing.
2. In \`parse_obd2_frame()\`, ensure frames with \`dlc < 8\` are marked \`valid = false\`.
3. Pass all 3 automated unit tests.`,
    entrypoint: 'test_runner.c',
    totalTests: 3,
    files: [
      {
        name: 'registers.h',
        readOnly: true,
        content: `#ifndef REGISTERS_H
#define REGISTERS_H
#include <stdint.h>
#include <stdbool.h>

typedef struct {
  volatile uint32_t CFSR;
  volatile uint32_t HFSR;
  volatile uint32_t MMFAR;
} SCB_Type;

extern SCB_Type SCB;
extern bool hardfault_triggered;

static inline void trigger_unaligned_fault(uintptr_t addr) {
  SCB.HFSR |= (1U << 30);
  SCB.MMFAR = (uint32_t)addr;
  hardfault_triggered = true;
}

#endif`
      },
      {
        name: 'can_parser.h',
        readOnly: true,
        content: `#ifndef CAN_PARSER_H
#define CAN_PARSER_H
#include <stdint.h>
#include <stdbool.h>

typedef struct {
  uint16_t standard_id;
  uint8_t  dlc;
  uint8_t  data[8];
} can_raw_frame_t;

typedef struct {
  uint16_t rpm;
  uint32_t odometer_km;
  uint8_t  coolant_temp;
  bool     valid;
} obd2_telemetry_t;

uint16_t parse_uint16_safe(const uint8_t *buffer, uint8_t offset);
uint32_t parse_uint32_safe(const uint8_t *buffer, uint8_t offset);
obd2_telemetry_t parse_obd2_frame(const can_raw_frame_t *frame);

#endif`
      },
      {
        name: 'can_parser.c',
        readOnly: false,
        content: `#include "can_parser.h"
#include "registers.h"
#include <string.h>

// BUG: Direct pointer cast causes HardFault on Cortex-M0 when offset is unaligned!
uint16_t parse_uint16_safe(const uint8_t *buffer, uint8_t offset) {
  return *(const uint16_t *)(buffer + offset);
}

uint32_t parse_uint32_safe(const uint8_t *buffer, uint8_t offset) {
  return *(const uint32_t *)(buffer + offset);
}

obd2_telemetry_t parse_obd2_frame(const can_raw_frame_t *frame) {
  obd2_telemetry_t tel;
  memset(&tel, 0, sizeof(tel));

  if (!frame) {
    tel.valid = false;
    return tel;
  }

  // BUG: Does not check dlc < 8
  tel.rpm = parse_uint16_safe(frame->data, 1);
  tel.odometer_km = parse_uint32_safe(frame->data, 3);
  tel.coolant_temp = frame->data[7];
  tel.valid = true;

  return tel;
}`
      },
      {
        name: 'test_runner.c',
        readOnly: true,
        content: `#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "can_parser.h"
#include "registers.h"

SCB_Type SCB = { 0, 0, 0 };
bool hardfault_triggered = false;

int main(void) {
  int passed = 0;
  const int total = 3;

  can_raw_frame_t frame;
  frame.standard_id = 0x7DF;
  frame.dlc = 8;
  frame.data[0] = 0x01;
  // Byte 1-2: RPM = 0x0FA0 (4000 RPM: 0xA0, 0x0F)
  frame.data[1] = 0xA0;
  frame.data[2] = 0x0F;
  // Byte 3-6: Odometer = 0x000186A0 (100000 km: 0xA0, 0x86, 0x01, 0x00)
  frame.data[3] = 0xA0;
  frame.data[4] = 0x86;
  frame.data[5] = 0x01;
  frame.data[6] = 0x00;
  frame.data[7] = 92;

  // Test 1: Unaligned uint16 read at odd offset 1
  uint16_t rpm = parse_uint16_safe(frame.data, 1);
  if (rpm == 4000) {
    printf("[PASS] test_unaligned_uint16_odd_offset\\n");
    passed++;
  } else {
    printf("[FAIL] test_unaligned_uint16_odd_offset (expected 4000, got %u)\\n", rpm);
  }

  // Test 2: Unaligned uint32 read at odd offset 3
  uint32_t odo = parse_uint32_safe(frame.data, 3);
  if (odo == 100000) {
    printf("[PASS] test_unaligned_uint32_odd_offset\\n");
    passed++;
  } else {
    printf("[FAIL] test_unaligned_uint32_odd_offset (expected 100000, got %u)\\n", odo);
  }

  // Test 3 (Hidden Edge Case): Full frame parsing across boundary with invalid DLC check
  obd2_telemetry_t tel = parse_obd2_frame(&frame);
  can_raw_frame_t short_frame = frame;
  short_frame.dlc = 4;
  obd2_telemetry_t tel_short = parse_obd2_frame(&short_frame);

  if (tel.valid && tel.rpm == 4000 && tel.odometer_km == 100000 && tel.coolant_temp == 92 && !tel_short.valid) {
    printf("[PASS] test_full_obd2_packet_parsing_and_dlc_validation\\n");
    passed++;
  } else {
    printf("[FAIL] test_full_obd2_packet_parsing_and_dlc_validation\\n");
  }

  printf("SUMMARY: %d/%d PASSED\\n", passed, total);
  return (passed == total) ? 0 : 1;
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

/** Get deterministic daily challenge based on UTC date string (YYYY-MM-DD). */
export function getDailyChallenge(): Challenge {
  const today = new Date().toISOString().slice(0, 10);
  const all = Object.values(SEED_CHALLENGES);
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) % all.length;
  }
  return all[Math.abs(hash)];
}

/** Get list of all unique skills across all challenges. */
export function getAllSkills(): string[] {
  const skillsSet = new Set<string>();
  for (const c of Object.values(SEED_CHALLENGES)) {
    if (c.skills) {
      c.skills.forEach(s => skillsSet.add(s));
    }
  }
  return Array.from(skillsSet).sort();
}
