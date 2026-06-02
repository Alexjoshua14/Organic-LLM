import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const profileGenerationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(
    parseInt(process.env.PROFILE_TREE_GENERATION_LIMIT ?? "6", 10),
    "1 h"
  ),
  prefix: "ratelimit:profile:generate",
});

const profileEditLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(
    parseInt(process.env.PROFILE_TREE_EDIT_LIMIT ?? "120", 10),
    "1 h"
  ),
  prefix: "ratelimit:profile:edit",
});

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  error?: string;
};

export async function checkProfileTreeGenerationLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await runLimiter("checkProfileTreeGenerationLimit", () =>
    profileGenerationLimiter.limit(userId)
  );

  if (!success) {
    return {
      success: false,
      error: "Profile generation is limited to 6 attempts per hour. Try again later.",
    };
  }

  return { success: true, remaining };
}

export async function checkProfileTreeEditLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await runLimiter("checkProfileTreeEditLimit", () =>
    profileEditLimiter.limit(userId)
  );

  if (!success) {
    return {
      success: false,
      error: "Too many profile edits. Try again later.",
    };
  }

  return { success: true, remaining };
}
