import { afterEach, describe, expect, mock, test } from "bun:test";

import type { MemoryItemType } from "@/lib/schemas/memory";

mock.module("server-only", () => ({}));

const searchState = {
  error: null as string | null,
  cacheHit: false,
  results: [] as MemoryItemType[],
};

const searchMemoriesWithL1Cache = mock(async () => ({
  result: searchState.error
    ? { data: null, error: searchState.error }
    : { data: { results: searchState.results }, error: null },
  metrics: { cacheHit: searchState.cacheHit, memorySearchMs: 1 },
}));

mock.module("@/lib/memory/memory-search-cache", () => ({
  searchMemoriesWithL1Cache,
}));

mock.module("@/data/supabase/profiles", () => ({
  getProfileTreeByProfileId: async () => ({ data: { tree: null }, error: null }),
}));

mock.module("@/lib/memory/query-planner", () => ({
  planMemoryQueries: async () => ({
    slots: { entity: "Organic LLM", topic: "roadmap" },
    queries: ["Organic LLM", "roadmap"],
    usedPlan: true,
  }),
  secondPassQuery: () => null,
}));

import { raceWithDeadline, runArcadiaMemoryPhase } from "@/lib/memory/arcadia-memory-phase";

describe("raceWithDeadline", () => {
  test("returns the value when work finishes in time", async () => {
    const { value, timedOut } = await raceWithDeadline(Promise.resolve("ok"), 80, "partial");

    expect(value).toBe("ok");
    expect(timedOut).toBe(false);
  });

  test("returns the fallback when work misses the deadline", async () => {
    const { value, timedOut } = await raceWithDeadline(
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("late"), 80);
      }),
      15,
      "partial"
    );

    expect(value).toBe("partial");
    expect(timedOut).toBe(true);
  });
});

describe("runArcadiaMemoryPhase rate-limit logs", () => {
  const originalWarn = console.warn;
  const warns: unknown[][] = [];

  afterEach(() => {
    warns.length = 0;
    console.warn = originalWarn;
    searchState.error = null;
    searchState.cacheHit = false;
    searchState.results = [];
    searchMemoriesWithL1Cache.mockClear();
  });

  test("Quick batches parallel memory.search denies into one warn", async () => {
    searchState.error = "Too many search requests";
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };

    await runArcadiaMemoryPhase({
      sbUserId: "user-1",
      userMessage: "how's my flagship",
      recentTurns: [],
      conversationMessagesInContext: 4,
      contextEffort: "quick",
    });

    expect(searchMemoriesWithL1Cache.mock.calls.length).toBe(2);

    const rateLimitWarns = warns.filter((args) =>
      args.some((arg) => typeof arg === "string" && arg.includes("Rate limits denied"))
    );

    expect(rateLimitWarns).toHaveLength(1);
    const payload = rateLimitWarns[0]?.find(
      (arg) => typeof arg === "object" && arg !== null && "rateLimits" in arg
    ) as { rateLimits?: { totalDenies?: number; byLimiter?: Array<{ limiter: string; hits: number }> } };

    expect(payload?.rateLimits?.totalDenies).toBe(2);
    expect(payload?.rateLimits?.byLimiter).toEqual([
      expect.objectContaining({ limiter: "memory.search", hits: 2, cap: 60, window: "1 m" }),
    ]);
  });

  test("does not warn when searches succeed", async () => {
    searchState.results = [{ id: "m1", memory: "flagship is Organic LLM", score: 0.9 }];
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };

    await runArcadiaMemoryPhase({
      sbUserId: "user-1",
      userMessage: "how's my flagship",
      recentTurns: [],
      conversationMessagesInContext: 4,
      contextEffort: "quick",
    });

    expect(
      warns.some((args) =>
        args.some((arg) => typeof arg === "string" && arg.includes("Rate limits denied"))
      )
    ).toBe(false);
  });
});
