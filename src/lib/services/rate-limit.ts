/**
 * Rate limiter factory
 * Stack contract: cache.engine=redis, cache.provider=upstash, security.rate_limiting=required
 * NFR-012: sliding-window rate limits per endpoint
 *
 * Dev fallback: when UPSTASH_REDIS_REST_URL / _TOKEN are absent and
 * NODE_ENV !== 'production', a no-op limiter is returned that always allows.
 * In production a missing Upstash env is a hard crash-at-import error.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// No-op limiter for dev/local without Upstash credentials
// ---------------------------------------------------------------------------
interface RateLimitResult {
  success: boolean;
  remaining: number;
}

const noopLimiter = {
  limit: async (_identifier: string): Promise<RateLimitResult> => ({
    success: true,
    remaining: Infinity,
  }),
} as unknown as Ratelimit;

// ---------------------------------------------------------------------------
// Redis singleton
// ---------------------------------------------------------------------------
let _redis: Redis | null = null;

function hasUpstashConfig(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

export function getRedis(): Redis {
  if (_redis) return _redis;
  if (!hasUpstashConfig()) {
    throw new Error(
      "Upstash Redis env vars (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) are not set."
    );
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return _redis;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createRateLimiter(
  prefix: string,
  requests: number,
  window: `${number}s` | `${number}m` | `${number}h` | `${number}d`
): Ratelimit {
  if (!hasUpstashConfig()) {
    // Staging is allowed to run without Upstash (no real users, low traffic).
    // Production-grade traffic must have it; the build/import time will warn.
    const isProdRuntime =
      process.env.NODE_ENV === "production" && process.env.STAGE !== "staging";
    if (isProdRuntime) {
      throw new Error(
        `[rate-limit] Upstash env vars are required in production (prefix: ${prefix}).`
      );
    }
    console.warn(
      `[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — using no-op limiter for "${prefix}" (${
        process.env.STAGE ?? process.env.NODE_ENV ?? "dev"
      })`
    );
    return noopLimiter;
  }

  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix,
    analytics: false,
  });
}

// Pre-built limiters for hot endpoints (NFR-012)
export const rateLimiters = {
  // Lead operations
  leadList: createRateLimiter("rl:lead:list", 600, "1h"),
  leadCreate: createRateLimiter("rl:lead:create", 200, "1h"),
  photoUpload: createRateLimiter("rl:photo:upload", 200, "1h"),
  quoteGenerate: createRateLimiter("rl:quote:generate", 100, "1d"),
  quoteSend: createRateLimiter("rl:quote:send", 100, "1d"),

  // Webhooks — high limits for DDoS guard (per NFR-012)
  daWebhook: createRateLimiter("rl:webhook:da", 1000, "1m"),
  twilioWebhook: createRateLimiter("rl:webhook:twilio", 1000, "1m"),

  // Customer-facing (IP-based)
  quoteView: createRateLimiter("rl:quote:view", 60, "1m"),
  quoteAccept: createRateLimiter("rl:quote:accept", 10, "1m"),

  // FSM OAuth
  fsmOAuth: createRateLimiter("rl:fsm:oauth", 30, "1h"),

  // Notifications
  pushSubscribe: createRateLimiter("rl:push:subscribe", 30, "1h"),
};
