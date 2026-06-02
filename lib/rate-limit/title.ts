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

/** Strata clipboard paste title LLM: 3× the Strata page title limits (separate Redis keys). */
const STRATA_CLIPBOARD_TITLE_GLOBAL_PER_H = 60;
const STRATA_CLIPBOARD_TITLE_PER_PAGE_PER_H = 9;

const strataClipboardTitleGlobalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(STRATA_CLIPBOARD_TITLE_GLOBAL_PER_H, "1 h"),
  prefix: "ratelimit:strata-clipboard-title:user",
});

const strataClipboardTitlePerPageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(STRATA_CLIPBOARD_TITLE_PER_PAGE_PER_H, "1 h"),
  prefix: "ratelimit:strata-clipboard-title:page",
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

/**
 * Strata clipboard-source-title API: triple the Strata document title limits (60/h user, 9/h page).
 */
export async function checkStrataClipboardSourceTitleLimit(
  userId: string,
  pageId: string
): Promise<RateLimitResult> {
  const global = await strataClipboardTitleGlobalLimiter.limit(userId);

  if (!global.success) {
    return {
      success: false,
      error: `Clipboard title limit reached (${STRATA_CLIPBOARD_TITLE_GLOBAL_PER_H} per hour). Try again later.`,
    };
  }

  const perPageKey = `${userId}:${pageId}`;
  const perPage = await strataClipboardTitlePerPageLimiter.limit(perPageKey);

  if (!perPage.success) {
    return {
      success: false,
      error: `This page has reached its clipboard title limit (${STRATA_CLIPBOARD_TITLE_PER_PAGE_PER_H} per hour). Try again later.`,
    };
  }

  return {
    success: true,
    remaining: Math.min(
      global.remaining ?? STRATA_CLIPBOARD_TITLE_GLOBAL_PER_H,
      perPage.remaining ?? STRATA_CLIPBOARD_TITLE_PER_PAGE_PER_H
    ),
  };
}
