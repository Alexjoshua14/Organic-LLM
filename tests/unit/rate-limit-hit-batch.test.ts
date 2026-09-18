import { afterEach, describe, expect, test } from "bun:test";

import { MEMORY_SEARCH_RATE_LIMIT } from "@/lib/rate-limit/catalog";
import {
  classifyRateLimitError,
  recordRateLimitHit,
  runWithRateLimitHitBatch,
  summarizeRateLimitHits,
} from "@/lib/rate-limit/hit-batch";

describe("classifyRateLimitError", () => {
  test("maps memory search and LLM message deny strings", () => {
    expect(classifyRateLimitError("Too many search requests")?.id).toBe("memory.search");
    expect(classifyRateLimitError("Too many LLM requests")?.id).toBe("llm.message");
    expect(classifyRateLimitError("socket hang up")).toBeUndefined();
  });
});

describe("summarizeRateLimitHits", () => {
  test("batches three memory.search denies into one limiter row", () => {
    const summary = summarizeRateLimitHits(
      [
        {
          limiter: "memory.search",
          remaining: 0,
          reset: 1_000,
          error: MEMORY_SEARCH_RATE_LIMIT.error,
          where: "checkMemorySearchLimit",
        },
        {
          limiter: "memory.search",
          remaining: 0,
          reset: 1_200,
          error: MEMORY_SEARCH_RATE_LIMIT.error,
          where: "checkMemorySearchLimit",
        },
        {
          limiter: "memory.search",
          remaining: 1,
          reset: 800,
          error: MEMORY_SEARCH_RATE_LIMIT.error,
          where: "checkMemorySearchLimit",
        },
      ],
      500
    );

    expect(summary.totalDenies).toBe(3);
    expect(summary.limiterCount).toBe(1);
    expect(summary.byLimiter[0]).toMatchObject({
      limiter: "memory.search",
      prefix: "ratelimit:memory:search",
      cap: 60,
      window: "1 m",
      hits: 3,
      remaining: 0,
      reset: 1_200,
      msUntilReset: 700,
    });
    expect(summary.byLimiter[0]?.why).toContain("Quick uses up to 3");
  });

  test("keeps distinct limiters separate", () => {
    const summary = summarizeRateLimitHits([
      {
        limiter: "memory.search",
        error: "Too many search requests",
        where: "checkMemorySearchLimit",
      },
      {
        limiter: "llm.message",
        error: "Too many LLM requests",
        where: "checkLlmMessageLimit",
      },
    ]);

    expect(summary.totalDenies).toBe(2);
    expect(summary.byLimiter.map((row) => row.limiter).sort()).toEqual([
      "llm.message",
      "memory.search",
    ]);
  });
});

describe("runWithRateLimitHitBatch", () => {
  const originalWarn = console.warn;
  const warns: unknown[][] = [];

  afterEach(() => {
    warns.length = 0;
    console.warn = originalWarn;
  });

  test("collects hits and does not warn per deny inside a batch", async () => {
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };

    const { hits } = await runWithRateLimitHitBatch(async () => {
      recordRateLimitHit({
        limiter: "memory.search",
        error: "Too many search requests",
        where: "checkMemorySearchLimit",
      });
      recordRateLimitHit({
        limiter: "memory.search",
        error: "Too many search requests",
        where: "checkMemorySearchLimit",
      });

      return "ok";
    });

    expect(hits).toHaveLength(2);
    expect(warns).toHaveLength(0);
  });

  test("warns immediately when there is no batch", () => {
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };

    recordRateLimitHit({
      limiter: "llm.message",
      error: "Too many LLM requests",
      where: "checkLlmMessageLimit",
    });

    expect(warns.length).toBe(1);
    const line = JSON.stringify(warns[0]);

    expect(line).toContain("llm.message");
    expect(line).toContain("checkLlmMessageLimit");
  });
});
