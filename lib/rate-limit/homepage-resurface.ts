import { Duration, Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const WINDOW: Duration = "10 m";

/**
 * Jev re-rankings of the homepage resurface row per user per window. Cache hits are free; only a
 * miss spends one. Kept apart from the chat message limit so a homepage load never costs the
 * user a message.
 */
const homepageResurfaceLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(6, WINDOW),
  prefix: "ratelimit:homepage:resurface",
});

export type HomepageResurfaceRateLimitResult = {
  success: boolean;
  retryAfterSec?: number;
};

export async function checkHomepageResurfaceLimit(
  userId: string
): Promise<HomepageResurfaceRateLimitResult> {
  const { success, reset } = await runLimiter("checkHomepageResurfaceLimit", () =>
    homepageResurfaceLimiter.limit(userId)
  );

  if (!success) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

    return { success: false, retryAfterSec };
  }

  return { success: true };
}
