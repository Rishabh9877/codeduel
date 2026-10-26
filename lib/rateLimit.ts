import { dynamo, TABLE } from "@/lib/dynamo";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  count: number;
}

/**
 * Extracts the client IP address from standard proxy headers.
 * Header precedence:
 * 1. Platform direct IP headers: "x-vercel-ip", "x-real-ip", "cf-connecting-ip" (unforgeable by client on edge)
 * 2. "x-forwarded-for": Standard reverse proxy header (takes first client IP before any proxies)
 * 3. Fallback: "127.0.0.1" (local development / testing)
 */
export function getClientIp(req: Request): string {
  // Prefer platform-trusted single-hop client IP headers first
  const vercelIp = req.headers.get("x-vercel-ip");
  if (vercelIp) return vercelIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return "127.0.0.1";
}

/**
 * Resolves action-specific rate limits from environment variables.
 * CRITICAL SECURITY RULE: DEMO_MODE must NEVER raise the verify-faculty rate limit!
 * Only student hints and practice submissions receive demo scaling.
 */
export function getActionRateLimit(
  action: "hint_solo" | "hint_match" | "practice_submit" | "verify_faculty",
  defaultLimit: number
): number {
  const isDemo = process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const envKey = `RATE_LIMIT_${action.toUpperCase()}`;
  const envVal = process.env[envKey];

  if (envVal && !isNaN(Number(envVal))) {
    return Number(envVal);
  }

  // verify-faculty must NEVER be raised by DEMO_MODE to prevent brute-force attacks
  if (action === "verify_faculty") {
    return defaultLimit;
  }

  // During active investor or academic demo presentations, scale threshold by 5x to prevent accidental 429 lockouts
  return isDemo ? defaultLimit * 5 : defaultLimit;
}

/**
 * Distributed, database-backed rate limiter for serverless environments.
 * Uses atomic increments in DynamoDB / PostgreSQL / persistent store so rate
 * limits are preserved across separate serverless lambda instances.
 */
export async function checkRateLimitDb(
  action: string,
  identifier: string,
  maxRequests: number,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const windowBucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const ttl = Math.floor(Date.now() / 1000) + windowSeconds * 2;
  const safeId = (identifier || "unknown").replace(/[^a-zA-Z0-9_.-]/g, "_");

  try {
    const res = await dynamo.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: {
          PK: `RATELIMIT#${action}#${safeId}`,
          SK: `BUCKET#${windowBucket}`,
        },
        UpdateExpression: "ADD #cnt :one SET ttl = :ttl",
        ExpressionAttributeNames: { "#cnt": "count" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": ttl },
        ReturnValues: "ALL_NEW",
      })
    );

    const count = Number(res.Attributes?.count ?? 1);
    if (count > maxRequests) {
      return { allowed: false, remaining: 0, count };
    }
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - count),
      count,
    };
  } catch (err) {
    // If rate-limit check fails, default to allowing with minimal remaining to avoid total service outage
    console.warn(`[RateLimit] Warning on ${action} for ${safeId}:`, err);
    return { allowed: true, remaining: 1, count: 1 };
  }
}
