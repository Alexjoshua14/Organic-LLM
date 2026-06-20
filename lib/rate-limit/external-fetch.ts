import "server-only";

import type { RateLimitResult } from "@/lib/rate-limit/llm";

import { Duration, Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const EXTERNAL_FETCH_LIMIT = parseInt(process.env.EXTERNAL_FETCH_RATE_LIMIT ?? "20", 10);
const EXTERNAL_FETCH_WINDOW: Duration = "1 m";

const requestLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(EXTERNAL_FETCH_LIMIT, EXTERNAL_FETCH_WINDOW),
  prefix: "ratelimit:external-fetch:request",
});

/**
 * Per-user limit for server-side external URL fetches (rabbit-hole analyze, future Arcadia direct fetch).
 */
export async function checkExternalFetchLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await runLimiter("checkExternalFetchLimit", () =>
    requestLimiter.limit(userId)
  );

  if (!success) {
    return { success: false, error: "Too many external fetch requests" };
  }

  return { success: true, remaining };
}
