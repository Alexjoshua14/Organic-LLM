import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

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
  const { success, remaining } = await runLimiter("checkChatsListLimit", () =>
    chatsListLimiter.limit(userId)
  );

  if (!success) {
    return {
      success: false,
      error: "Too many requests. Thread list is limited to 240 requests per hour. Try again later.",
    };
  }

  return { success: true, remaining };
}

/**
 * Sidebar activity (GET /api/chats/activity, POST /api/chats/[id]/seen): 1800 per hour per user.
 * Sized for polling every 3s while something is working (`SESSION_ACTIVITY_POLL_WORKING_MS`),
 * with headroom for focus revalidation and seen writes. The payload is a handful of ids, so the
 * budget is wider than the thread list's.
 */
const chatsActivityLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1800, "1 h"),
  prefix: "ratelimit:chats:activity",
});

export async function checkChatsActivityLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await runLimiter("checkChatsActivityLimit", () =>
    chatsActivityLimiter.limit(userId)
  );

  if (!success) {
    return {
      success: false,
      error:
        "Too many requests. Sidebar activity is limited to 1800 requests per hour. Try again later.",
    };
  }

  return { success: true, remaining };
}
