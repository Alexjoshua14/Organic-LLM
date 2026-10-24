import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const syncMinuteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:spatial-artifacts:sync:minute",
});

const syncHourLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, "1 h"),
  prefix: "ratelimit:spatial-artifacts:sync:hour",
});

export type RateLimitResult = { success: boolean; error?: string };

export async function checkSpatialArtifactSyncLimit(
  userId: string,
  priority: "high" | "normal" | "low"
): Promise<RateLimitResult> {
  if (priority === "high") {
    const { success } = await runLimiter("checkSpatialArtifactSyncLimit:high", () =>
      syncMinuteLimiter.limit(`${userId}:high`)
    );

    return success ? { success: true } : { success: false, error: "Too many pin sync requests" };
  }

  const minute = await runLimiter("checkSpatialArtifactSyncLimit:minute", () =>
    syncMinuteLimiter.limit(userId)
  );

  if (!minute.success) {
    return { success: false, error: "Too many artifact sync requests per minute" };
  }

  const hour = await runLimiter("checkSpatialArtifactSyncLimit:hour", () =>
    syncHourLimiter.limit(userId)
  );

  if (!hour.success) {
    return { success: false, error: "Too many artifact sync requests per hour" };
  }

  return { success: true };
}
