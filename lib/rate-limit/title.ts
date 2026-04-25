import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";

/** Global: 20 title generations per hour per user (sliding). */
const titleGlobalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
  prefix: "ratelimit:title:user",
});

/** Per-chat: 3 title generations per hour per (user, chat) (sliding). */
const titlePerChatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "ratelimit:title:chat",
});

/** Per Strata page: 3 title generations per hour per (user, page) (sliding). */
const titlePerStrataPageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "ratelimit:title:strata",
});

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  error?: string;
};

/**
 * Check title-generation rate limits. Must pass both:
 * - 20 per hour per user (global)
 * - 3 per hour per (user, chat)
 */
export async function checkTitleGenerationLimit(
  userId: string,
  chatId: string
): Promise<RateLimitResult> {
  const global = await titleGlobalLimiter.limit(userId);

  if (!global.success) {
    return {
      success: false,
      error: "Title generation limit reached (20 per hour). Try again later.",
    };
  }

  const perChatKey = `${userId}:${chatId}`;
  const perChat = await titlePerChatLimiter.limit(perChatKey);

  if (!perChat.success) {
    return {
      success: false,
      error: "This chat has reached its title generation limit (3 per hour). Try again later.",
    };
  }

  return {
    success: true,
    remaining: Math.min(global.remaining ?? 20, perChat.remaining ?? 3),
  };
}

/**
 * Strata title generation: same global 20/hour per user as chat, plus 3/hour per Strata page.
 */
export async function checkStrataTitleGenerationLimit(
  userId: string,
  pageId: string
): Promise<RateLimitResult> {
  const global = await titleGlobalLimiter.limit(userId);

  if (!global.success) {
    return {
      success: false,
      error: "Title generation limit reached (20 per hour). Try again later.",
    };
  }

  const perStrataKey = `${userId}:${pageId}`;
  const perStrata = await titlePerStrataPageLimiter.limit(perStrataKey);

  if (!perStrata.success) {
    return {
      success: false,
      error:
        "This Strata page has reached its title generation limit (3 per hour). Try again later.",
    };
  }

  return {
    success: true,
    remaining: Math.min(global.remaining ?? 20, perStrata.remaining ?? 3),
  };
}
