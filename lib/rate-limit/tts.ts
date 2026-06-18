import "server-only";

import type { RateLimitResult } from "@/lib/rate-limit/llm";

import { Duration, Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const TTS_REQUEST_LIMIT = parseInt(process.env.TTS_RATE_LIMIT_REQUESTS ?? "30", 10);
const TTS_REQUEST_WINDOW: Duration = "1 m";

const TTS_CHAR_LIMIT = parseInt(process.env.TTS_RATE_LIMIT_CHARS ?? "50000", 10);
const TTS_CHAR_WINDOW: Duration = "1 m";

/** Request-based: N TTS requests per window per user (sliding). */
const requestLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(TTS_REQUEST_LIMIT, TTS_REQUEST_WINDOW),
  prefix: "ratelimit:tts:request",
});

/** Character-based: capacity in characters per window per user (sliding). */
const charLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(TTS_CHAR_LIMIT, TTS_CHAR_WINDOW),
  prefix: "ratelimit:tts:char",
});

/**
 * Check TTS request rate limit. Call before each TTS request.
 * Uses Supabase user id as identifier (same as LLM limits).
 */
export async function checkTtsRequestLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await runLimiter("checkTtsRequestLimit", () =>
    requestLimiter.limit(userId)
  );

  if (!success) {
    return { success: false, error: "Too many TTS requests" };
  }

  return { success: true, remaining };
}

/**
 * Check and record TTS character usage for the request.
 * Rejects if remaining capacity is less than charCount.
 */
export async function checkTtsCharLimit(
  userId: string,
  charCount: number
): Promise<RateLimitResult> {
  if (charCount <= 0) {
    return { success: true };
  }

  const { remaining } = await runLimiter("checkTtsCharLimit", () =>
    charLimiter.getRemaining(userId)
  );

  if (remaining < charCount) {
    return {
      success: false,
      error: "TTS character limit exceeded",
      remaining,
    };
  }

  await runLimiter("recordTtsCharUsage", () => charLimiter.limit(userId, { rate: charCount }));

  return { success: true, remaining: remaining - charCount };
}
