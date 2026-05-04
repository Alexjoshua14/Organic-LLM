import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";

/** Wipe: strict — 3 requests per hour per user (sliding). */
const memoryWipeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "ratelimit:memory:wipe",
});

/** Delete (single): 30 per hour per user (sliding). */
const memoryDeleteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  prefix: "ratelimit:memory:delete",
});

/** Search: 60 per minute per user (sliding). */
const memorySearchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:memory:search",
});

/** List / get all: 60 per minute per user. */
const memoryListLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "ratelimit:memory:list",
});

/** Add (e.g. chat turn to memory): 120 per hour per user (sliding). */
const memoryAddLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 h"),
  prefix: "ratelimit:memory:add",
});

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  error?: string;
};

export async function checkMemoryWipeLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await memoryWipeLimiter.limit(userId);

  if (!success) {
    return { success: false, error: "Too many wipe requests" };
  }

  return { success: true, remaining };
}

export async function checkMemoryDeleteLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await memoryDeleteLimiter.limit(userId);

  if (!success) {
    return { success: false, error: "Too many delete requests" };
  }

  return { success: true, remaining };
}

export async function checkMemorySearchLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await memorySearchLimiter.limit(userId);

  if (!success) {
    return { success: false, error: "Too many search requests" };
  }

  return { success: true, remaining };
}

export async function checkMemoryListLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await memoryListLimiter.limit(userId);

  if (!success) {
    return { success: false, error: "Too many list requests" };
  }

  return { success: true, remaining };
}

export async function checkMemoryAddLimit(userId: string): Promise<RateLimitResult> {
  const { success, remaining } = await memoryAddLimiter.limit(userId);

  if (!success) {
    return { success: false, error: "Too many memory add requests" };
  }

  return { success: true, remaining };
}
