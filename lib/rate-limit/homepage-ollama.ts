import { Duration, Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const WINDOW: Duration = "15 s";

/** At most one homepage Ollama call per user per 15 seconds (preview + plan share this bucket). */
const homepageOllamaLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, WINDOW),
  prefix: "ratelimit:homepage:ollama",
});

export type HomepageOllamaRateLimitResult = {
  success: boolean;
  retryAfterSec?: number;
};

export async function checkHomepageOllamaLimit(
  userId: string
): Promise<HomepageOllamaRateLimitResult> {
  const { success, reset } = await runLimiter("checkHomepageOllamaLimit", () =>
    homepageOllamaLimiter.limit(userId)
  );

  if (!success) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

    return { success: false, retryAfterSec };
  }

  return { success: true };
}
