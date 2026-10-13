import { SEED_CHALLENGES } from '../lib/challenges';
import { executeChallenge } from '../lib/challengeExecutor';

// Known solutions for all 10 challenges
const SOLUTIONS: Record<string, Record<string, string>> = {
  'swe-token-bucket': {
    'rateLimiter.ts': `import { BucketConfig, BucketState } from './types';

export class TokenBucketLimiter {
  constructor(public config: BucketConfig, public state: BucketState) {}

  consume(tokensRequested: number = 1): boolean {
    const now = Date.now();
    const elapsedSeconds = (now - this.state.lastRefillMs) / 1000;
    
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

  'embedded-ring-buffer': {
    'ring_buffer.c': `#include "ring_buffer.h"

void rb_init(RingBuffer *rb) {
    rb->head = 0;
    rb->tail = 0;
    rb->count = 0;
}

bool rb_is_full(const RingBuffer *rb) {
    return (rb->count >= RB_SIZE);
}

bool rb_is_empty(const RingBuffer *rb) {
    return (rb->count == 0);
}

bool rb_write(RingBuffer *rb, uint8_t data) {
    if (rb_is_full(rb)) return false;
    rb->buffer[rb->head] = data;
    rb->head = (rb->head + 1) % RB_SIZE;
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

  'swe-retry-backoff': {
    'backoff.ts': `import { BackoffConfig } from './types';

export function computeRetryDelay(attempt: number, config: BackoffConfig): number {
  const exponentialCap = Math.min(config.maxDelayMs, config.baseDelayMs * Math.pow(2, attempt));
  const delay = Math.random() * exponentialCap;
  return Math.min(config.maxDelayMs, Math.max(0, delay));
}`
  },

  'embedded-gpio-debounce': {
    'gpio_debounce.c': `#include "debounce.h"

void debouncer_init(Debouncer *d, bool initial_level, uint32_t current_time_ms) {
    d->stable_state = initial_level;
    d->last_raw_sample = initial_level;
    d->last_transition_ms = current_time_ms;
}

bool debouncer_update(Debouncer *d, bool raw_sample, uint32_t current_time_ms) {
    if (raw_sample != d->last_raw_sample) {
        d->last_raw_sample = raw_sample;
        d->last_transition_ms = current_time_ms;
    }

    if (raw_sample != d->stable_state) {
        if ((current_time_ms - d->last_transition_ms) >= DEBOUNCE_THRESHOLD_MS) {
            d->stable_state = raw_sample;
            return true;
        }
    }
    return false;
}`
  },

  'swe-jwt-alg-confusion': {
    'verifier.ts': `import { JwtHeader, JwtPayload, VerificationOptions, VerificationResult } from './types';

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

  const alg = (header.alg || '').toUpperCase();

  if (options.allowedAlgorithms && options.allowedAlgorithms.length > 0) {
    const allowed = options.allowedAlgorithms.map((a) => a.toUpperCase());
    if (!allowed.includes(alg)) {
      return { valid: false, error: 'Algorithm not permitted' };
    }
  }

  if (alg === 'NONE') {
    if (options.allowedAlgorithms && options.allowedAlgorithms.map((a) => a.toUpperCase()).includes('NONE')) {
      return { valid: true, payload };
    }
    return { valid: false, error: 'Algorithm none is forbidden' };
  }

  const signature = parts[2] || '';
  if (!signature || signature !== \`sig_\${secretKey}\`) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true, payload };
}`
  },

  'swe-connection-pool-leak': {
    'pool.ts': `import { Connection, PoolConfig } from './types';

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
    try {
      return await fn(conn);
    } finally {
      this.release(conn);
    }
  }
}`
  },

  'swe-cache-stampede': {
    'cache.ts': `import { CacheEntry } from './types';

export class SingleFlightCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private inFlight = new Map<string, Promise<T>>();

  constructor(private ttlMs: number = 5000) {}

  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      try {
        const value = await fetcher();
        this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
  }
}`
  },

  'embedded-spi-endianness': {
    'imu_driver.c': `#include "imu_driver.h"

int16_t imu_parse_axis(uint8_t msb, uint8_t lsb) {
    uint16_t raw = ((uint16_t)msb << 8) | (uint16_t)lsb;
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

  'embedded-pwm-prescaler': {
    'pwm_timer.c': `#include "pwm_timer.h"

uint16_t pwm_calculate_prescaler(uint32_t timer_clk_hz, uint32_t target_freq_hz, uint16_t arr) {
    if (target_freq_hz == 0 || arr == 0) return 0;
    uint32_t div = timer_clk_hz / (target_freq_hz * (arr + 1));
    return (div > 0) ? (uint16_t)(div - 1) : 0;
}

uint16_t pwm_duty_to_ccr(uint8_t duty_percent, uint16_t arr) {
    if (duty_percent > 100) duty_percent = 100;
    return (uint16_t)(((uint32_t)duty_percent * arr) / 100);
}`
  },

  'swe-async-worker-leak': {
    'stream_worker.py': `from types_def import ConnectionTracker, MockConnection

def process_batch(tracker: ConnectionTracker, batch_id: int, records: list) -> int:
    conn = tracker.create_conn(batch_id)
    try:
        processed = 0
        for r in records:
            if r < 0:
                raise ValueError(f"Negative record {r} rejected")
            processed += r
        return processed
    finally:
        conn.close()`
  },

  'embedded-interrupt-race': {
    'telemetry.c': `#include "telemetry.h"
#include "registers.h"
#include <string.h>

static volatile uint32_t packet_count = 0;
static volatile uint32_t dropped_packets = 0;
static volatile uint64_t last_timestamp_us = 0;
static volatile bool isr_active = false;

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
  uint32_t primask = __get_PRIMASK();
  __disable_irq();
  stats.packet_count = packet_count;
  stats.dropped_packets = dropped_packets;
  stats.last_timestamp_us = last_timestamp_us;
  stats.isr_active = isr_active;
  if (!primask) {
    __enable_irq();
  }
  return stats;
}

bool telemetry_wait_for_packets(uint32_t target_count, uint32_t timeout_loops) {
  uint32_t loops = 0;
  while (packet_count < target_count) {
    loops++;
    if (loops > timeout_loops) {
      return false;
    }
  }
  return true;
}`
  },

  'embedded-packed-alignment': {
    'can_parser.c': `#include "can_parser.h"
#include "registers.h"
#include <string.h>

uint16_t parse_uint16_safe(const uint8_t *buffer, uint8_t offset) {
  uint16_t result = 0;
  memcpy(&result, buffer + offset, sizeof(uint16_t));
  return result;
}

uint32_t parse_uint32_safe(const uint8_t *buffer, uint8_t offset) {
  uint32_t result = 0;
  memcpy(&result, buffer + offset, sizeof(uint32_t));
  return result;
}

obd2_telemetry_t parse_obd2_frame(const can_raw_frame_t *frame) {
  obd2_telemetry_t tel;
  memset(&tel, 0, sizeof(tel));

  if (!frame || frame->dlc < 8) {
    tel.valid = false;
    return tel;
  }

  tel.rpm = parse_uint16_safe(frame->data, 1);
  tel.odometer_km = parse_uint32_safe(frame->data, 3);
  tel.coolant_temp = frame->data[7];
  tel.valid = true;

  return tel;
}`
  }
};

async function main() {
  console.log("=== VERIFYING SOLUTIONS FOR ALL 12 CHALLENGES ===");
  let allGood = true;

  for (const [id, challenge] of Object.entries(SEED_CHALLENGES)) {
    const patch = SOLUTIONS[id];
    if (!patch) {
      console.log(`[WARN] No patch defined for ${id}`);
      allGood = false;
      continue;
    }

    const res = await executeChallenge(challenge, patch);
    const passIndicator = res.allPassed ? "✅ PASS" : "❌ FAIL";
    console.log(`${passIndicator} ${id.padEnd(25)} -> ${res.passed}/${res.total} tests passed (status: ${res.status})`);
    if (!res.allPassed) {
      allGood = false;
      console.log(`   STDOUT:\n${res.stdout}`);
      if (res.stderr) console.log(`   STDERR:\n${res.stderr}`);
    }
  }

  if (allGood) {
    console.log("\n🎉 ALL 10 CHALLENGES VERIFIED AND PASS 100%!");
  } else {
    console.log("\n⚠️ Some challenges failed verification.");
    process.exit(1);
  }
}

main().catch(console.error);
