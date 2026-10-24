import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import {
  MEMORY_ADD_RATE_LIMIT,
  MEMORY_DELETE_RATE_LIMIT,
  MEMORY_LIST_RATE_LIMIT,
  MEMORY_SEARCH_RATE_LIMIT,
  MEMORY_WIPE_RATE_LIMIT,
  type RateLimitCatalogEntry,
} from "@/lib/rate-limit/catalog";
import { recordRateLimitHit } from "@/lib/rate-limit/hit-batch";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const memoryWipeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MEMORY_WIPE_RATE_LIMIT.cap, MEMORY_WIPE_RATE_LIMIT.window),
  prefix: MEMORY_WIPE_RATE_LIMIT.prefix,
});

const memoryDeleteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MEMORY_DELETE_RATE_LIMIT.cap, MEMORY_DELETE_RATE_LIMIT.window),
  prefix: MEMORY_DELETE_RATE_LIMIT.prefix,
});

const memorySearchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MEMORY_SEARCH_RATE_LIMIT.cap, MEMORY_SEARCH_RATE_LIMIT.window),
  prefix: MEMORY_SEARCH_RATE_LIMIT.prefix,
});

const memoryListLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MEMORY_LIST_RATE_LIMIT.cap, MEMORY_LIST_RATE_LIMIT.window),
  prefix: MEMORY_LIST_RATE_LIMIT.prefix,
});

const memoryAddLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MEMORY_ADD_RATE_LIMIT.cap, MEMORY_ADD_RATE_LIMIT.window),
  prefix: MEMORY_ADD_RATE_LIMIT.prefix,
});

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  limit?: number;
  reset?: number;
  error?: string;
};

type LimiterResponse = {
  success: boolean;
  remaining?: number;
  limit?: number;
  reset?: number;
};

async function runMemoryLimit(
  where: string,
  catalog: RateLimitCatalogEntry,
  op: () => Promise<LimiterResponse>
): Promise<RateLimitResult> {
  const { success, remaining, limit, reset } = await runLimiter(where, op);

  if (!success) {
    recordRateLimitHit({
      limiter: catalog.id,
      prefix: catalog.prefix,
      cap: catalog.cap,
      window: catalog.window,
      remaining,
      limit,
      reset,
      error: catalog.error,
      where,
    });

    return { success: false, error: catalog.error, remaining, limit, reset };
  }

  return { success: true, remaining, limit, reset };
}

export async function checkMemoryWipeLimit(userId: string): Promise<RateLimitResult> {
  return runMemoryLimit("checkMemoryWipeLimit", MEMORY_WIPE_RATE_LIMIT, () =>
    memoryWipeLimiter.limit(userId)
  );
}

export async function checkMemoryDeleteLimit(userId: string): Promise<RateLimitResult> {
  return runMemoryLimit("checkMemoryDeleteLimit", MEMORY_DELETE_RATE_LIMIT, () =>
    memoryDeleteLimiter.limit(userId)
  );
}

export async function checkMemorySearchLimit(userId: string): Promise<RateLimitResult> {
  return runMemoryLimit("checkMemorySearchLimit", MEMORY_SEARCH_RATE_LIMIT, () =>
    memorySearchLimiter.limit(userId)
  );
}

export async function checkMemoryListLimit(userId: string): Promise<RateLimitResult> {
  return runMemoryLimit("checkMemoryListLimit", MEMORY_LIST_RATE_LIMIT, () =>
    memoryListLimiter.limit(userId)
  );
}

export async function checkMemoryAddLimit(userId: string): Promise<RateLimitResult> {
  return runMemoryLimit("checkMemoryAddLimit", MEMORY_ADD_RATE_LIMIT, () =>
    memoryAddLimiter.limit(userId)
  );
}
