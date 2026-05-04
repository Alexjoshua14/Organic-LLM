import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";

/** Thread list (GET /api/chats): 240 requests per hour per user (sliding). */
const chatsListLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(240, "1 h"),
  prefix: "ratelimit:chats:list",
});

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  error?: string;
};

/**
 * Check thread-list rate limit. Call before getChats in GET /api/chats.
 * 240 requests per hour per user (sliding window).
 */
export async function checkChatsListLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await chatsListLimiter.limit(userId);

  if (!success) {
    return {
      success: false,
      error: "Too many requests. Thread list is limited to 240 requests per hour. Try again later.",
    };
  }

  return { success: true, remaining };
}
