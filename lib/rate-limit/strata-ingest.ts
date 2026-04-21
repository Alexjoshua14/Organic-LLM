import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";

import type { RateLimitResult } from "./title";

const ingestGlobalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(40, "1 h"),
  prefix: "ratelimit:strata-ingest:user",
});

const ingestPerPageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(25, "1 h"),
  prefix: "ratelimit:strata-ingest:page",
});

/**
 * Strata source ingest (search / URL preview / URL commit / append validation): bounded per user and per page.
 */
export async function checkStrataIngestLimit(
  userId: string,
  pageId: string
): Promise<RateLimitResult> {
  const global = await ingestGlobalLimiter.limit(userId);

  if (!global.success) {
    return {
      success: false,
      error: "Strata ingest limit reached (40 per hour). Try again later.",
    };
  }

  const perPageKey = `${userId}:${pageId}`;
  const perPage = await ingestPerPageLimiter.limit(perPageKey);

  if (!perPage.success) {
    return {
      success: false,
      error: "This page has reached its ingest limit (25 per hour). Try again later.",
    };
  }

  return {
    success: true,
    remaining: Math.min(global.remaining ?? 40, perPage.remaining ?? 25),
  };
}
