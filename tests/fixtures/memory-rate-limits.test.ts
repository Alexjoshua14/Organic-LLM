// Real server actions, operations, and limiter wiring with mocked external services.
import { beforeEach, describe, expect, mock, test } from "bun:test";

let clerkUser: string | null = "clerk-owner";
const limit = mock(async (_userId: string, _prefix: string) => ({
  success: true,
  remaining: 10,
  limit: 60,
  reset: 1000,
}));
const configurations: { prefix: string; limiter: { cap: number; window: string } }[] = [];
const hit = mock(() => {});
const search = mock(async () => ({
  results: [{ id: "own-memory", memory: "Own memory", score: 0.9 }],
  relations: [],
}));
const list = mock(async () => ({ results: [], relations: [] }));
const remove = mock(async () => true);
const database = mock(async () => {
  throw new Error("Database must not be contacted for rejected feedback");
});

mock.module("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow(cap: number, window: string) {
      return { cap, window };
    }
    constructor(private options: (typeof configurations)[number]) {
      configurations.push(options);
    }
    limit(userId: string) {
      return limit(userId, this.options.prefix);
    }
  },
}));
mock.module("@/lib/rate-limit/hit-batch", () => ({ recordRateLimitHit: hit }));
mock.module("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: clerkUser }) }));
mock.module("@/data/supabase/profiles", () => ({
  getSupabaseUserId: async (userId: string) => ({
    data: userId.replace("clerk-", "profile-"),
    error: null,
  }),
}));
mock.module("@/lib/supabase/server", () => ({ supabaseServer: database }));
mock.module("@/lib/memory/store", () => ({
  searchMemories: search,
  getAllMemories: list,
  deleteMemory: remove,
  wipeMemory: mock(async () => true),
  addLatestMessagesToMemory: mock(async () => ({ results: [] })),
  addMemory: mock(async () => ({ results: [] })),
}));

const { getCurrentUserMemoriesBySearch, deleteMemoryForCurrentUser } = await import(
  "@/lib/memory/operations"
);
const { actionRecordMemoryFeedback } = await import("@/app/actions/memory-feedback");

beforeEach(() => {
  clerkUser = "clerk-owner";
  limit.mockReset().mockResolvedValue({ success: true, remaining: 10, limit: 60, reset: 1000 });
  search.mockClear();
  list.mockClear();
  remove.mockClear();
  database.mockClear();
  hit.mockClear();
});

describe("memory server rate limits", () => {
  test("search and feedback use separate 60/minute buckets; deletion uses 30/hour", () => {
    expect(configurations).toContainEqual(
      expect.objectContaining({
        prefix: "ratelimit:memory:search",
        limiter: { cap: 60, window: "1 m" },
      })
    );
    expect(configurations).toContainEqual(
      expect.objectContaining({
        prefix: "ratelimit:memory:feedback",
        limiter: { cap: 60, window: "1 m" },
      })
    );
    expect(configurations).toContainEqual(
      expect.objectContaining({
        prefix: "ratelimit:memory:delete",
        limiter: { cap: 30, window: "1 h" },
      })
    );
  });

  test("search limits use server-resolved profile identity and exhaustion prevents vector searches", async () => {
    limit.mockResolvedValueOnce({ success: false, remaining: 0, limit: 60, reset: 1000 });
    expect(await getCurrentUserMemoriesBySearch("tea", 100)).toEqual({
      data: null,
      error: "Too many search requests",
    });
    expect(limit).toHaveBeenCalledWith("profile-owner", "ratelimit:memory:search");
    expect(search).not.toHaveBeenCalled();
    expect(hit).toHaveBeenCalledWith(
      expect.objectContaining({ limiter: "memory.search", remaining: 0 })
    );
  });

  test("different signed-in users search under separate identities", async () => {
    expect((await getCurrentUserMemoriesBySearch("tea", 25)).data?.results[0]?.memory).toBe(
      "Own memory"
    );
    clerkUser = "clerk-other";
    await getCurrentUserMemoriesBySearch("coffee", 5);
    expect(limit).toHaveBeenNthCalledWith(1, "profile-owner", "ratelimit:memory:search");
    expect(limit).toHaveBeenNthCalledWith(2, "profile-other", "ratelimit:memory:search");
    expect(search).toHaveBeenNthCalledWith(1, "tea", "profile-owner", { limit: 25 });
    expect(search).toHaveBeenNthCalledWith(2, "coffee", "profile-other", { limit: 5 });
  });

  test("a limiter outage does not fall through to search", async () => {
    limit.mockRejectedValueOnce(new Error("Limiter unavailable"));
    expect((await getCurrentUserMemoriesBySearch("tea", 100)).data).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });

  test("delete and both vote actions enforce limits before ownership reads or writes", async () => {
    limit.mockResolvedValue({ success: false, remaining: 0, limit: 60, reset: 1000 });
    expect((await deleteMemoryForCurrentUser("own-memory")).error).toBe("Too many delete requests");
    for (const signal of ["up", "down"] as const) {
      const result = await actionRecordMemoryFeedback({
        memoryId: "own-memory",
        signal,
        source: "memory_lens",
      });
      expect(result.data).toBeNull();
      expect(result.error).toContain("Please wait");
    }
    expect(limit).toHaveBeenCalledWith("profile-owner", "ratelimit:memory:delete");
    expect(limit).toHaveBeenCalledWith("profile-owner", "ratelimit:memory:feedback");
    expect(list).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(database).not.toHaveBeenCalled();
  });

  test("signed-out search, delete, and votes are rejected before any backing service", async () => {
    clerkUser = null;
    expect((await getCurrentUserMemoriesBySearch("tea")).error).toBe("Not signed in");
    expect((await deleteMemoryForCurrentUser("own-memory")).error).toBe("Not signed in");
    expect(
      (
        await actionRecordMemoryFeedback({
          memoryId: "own-memory",
          signal: "up",
          source: "memory_lens",
        })
      ).error
    ).toBe("Not signed in");
    expect(limit).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(database).not.toHaveBeenCalled();
  });
});
