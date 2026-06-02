import type { RateLimitResult } from "./title";

import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "@/lib/redis/redis";
import { runLimiter } from "@/lib/rate-limit/run-limiter";

const ingestGlobalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(40, "1 h"),
  prefix: "ratelimit:strata-ingest:user",
});

const ingestPerPageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(25, "1 h"),
  prefix: "ratelimit:strata-ingest:page",
});

/**
 * Notepad Yjs append-update limiter. CRDT updates are tiny but bursty under heavy typing, so the
 * caps are an order of magnitude looser than the search/ingest endpoints.
 */
const STRATA_NOTEPAD_GLOBAL_PER_H = 600;
const STRATA_NOTEPAD_PER_PAGE_PER_H = 200;

const notepadGlobalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(STRATA_NOTEPAD_GLOBAL_PER_H, "1 h"),
  prefix: "ratelimit:strata-notepad:user",
});

const notepadPerPageLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(STRATA_NOTEPAD_PER_PAGE_PER_H, "1 h"),
  prefix: "ratelimit:strata-notepad:page",
});

export async function checkStrataNotepadUpdateLimit(
  userId: string,
  pageId: string
): Promise<RateLimitResult> {
  const global = await runLimiter("checkStrataNotepadUpdateLimit:global", () =>
    notepadGlobalLimiter.limit(userId)
  );

  if (!global.success) {
    return {
      success: false,
      error: `Notepad sync limit reached (${STRATA_NOTEPAD_GLOBAL_PER_H} per hour). Try again later.`,
    };
  }

  const perPage = await runLimiter("checkStrataNotepadUpdateLimit:perPage", () =>
    notepadPerPageLimiter.limit(`${userId}:${pageId}`)
  );

  if (!perPage.success) {
    return {
      success: false,
      error: `This page has reached its notepad sync limit (${STRATA_NOTEPAD_PER_PAGE_PER_H} per hour). Try again later.`,
    };
  }

  return {
    success: true,
    remaining: Math.min(
      global.remaining ?? STRATA_NOTEPAD_GLOBAL_PER_H,
      perPage.remaining ?? STRATA_NOTEPAD_PER_PAGE_PER_H
    ),
  };
}

/**
 * Strata source ingest (search / URL preview / URL commit / append validation): bounded per user and per page.
 */
export async function checkStrataIngestLimit(
  userId: string,
  pageId: string
): Promise<RateLimitResult> {
  const global = await runLimiter("checkStrataIngestLimit:global", () =>
    ingestGlobalLimiter.limit(userId)
  );

  if (!global.success) {
    return {
      success: false,
      error: "Strata ingest limit reached (40 per hour). Try again later.",
    };
  }

  const perPageKey = `${userId}:${pageId}`;
  const perPage = await runLimiter("checkStrataIngestLimit:perPage", () =>
    ingestPerPageLimiter.limit(perPageKey)
  );

  if (!perPage.success) {
    return {
      success: false,
      error: "This page has reached its ingest limit (25 per hour). Try again later.",
    };
  }

  return {
    success: true,
    remaining: Math.min(global.remaining ?? 40, perPage.remaining ?? 25),
  };
}
