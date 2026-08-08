import "server-only";

import type { RateLimitResult } from "@/lib/rate-limit/llm";

import { Duration, Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const GOOGLE_PLACES_LIMIT = parseInt(process.env.GOOGLE_PLACES_RATE_LIMIT ?? "100", 10);
const GOOGLE_PLACES_WINDOW: Duration = "1 h";

const requestLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(GOOGLE_PLACES_LIMIT, GOOGLE_PLACES_WINDOW),
  prefix: "ratelimit:google-places:request",
});

/**
 * Per-user rolling limit for Google Places API HTTP calls (search, details, photo media).
 * Call once before each outbound Places request.
 */
export async function checkGooglePlacesLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await runLimiter("checkGooglePlacesLimit", () =>
    requestLimiter.limit(userId)
  );

  if (!success) {
    return { success: false, error: "Too many Google Places API requests" };
  }

  return { success: true, remaining };
}
