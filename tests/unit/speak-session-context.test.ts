import { describe, expect, test } from "bun:test";

import {
  formatSpeakSessionContext,
  loadSpeakSessionContext,
  SPEAK_CONTEXT_MEMORY_OVERFETCH,
  type LoadSpeakSessionContextDeps,
} from "@/lib/speak/speak-session-context";

describe("formatSpeakSessionContext", () => {
  test("returns an empty string when there is nothing to carry in", () => {
    expect(formatSpeakSessionContext({ summary: null, recentTurns: [], memories: [] })).toBe("");
  });

  test("orders summary, then memories, then the most recent exchange", () => {
    const text = formatSpeakSessionContext({
      summary: "We planned a trip.",
      recentTurns: [
        { role: "user", text: "Where should we go?" },
        { role: "assistant", text: "Kyoto in autumn." },
      ],
      memories: ["User prefers trains over flights."],
    });

    const summaryAt = text.indexOf("Conversation so far:");
    const memoriesAt = text.indexOf("Things you remember about this user:");
    const recentAt = text.indexOf("Most recent exchange:");

    expect(summaryAt).toBeGreaterThanOrEqual(0);
    expect(memoriesAt).toBeGreaterThan(summaryAt);
    expect(recentAt).toBeGreaterThan(memoriesAt);
    expect(text).toContain("User: Where should we go?");
    expect(text).toContain("You: Kyoto in autumn.");
  });

  test("trims oldest turns first, then memories, then the summary to fit the budget", () => {
    const long = "word ".repeat(120).trim();
    const input = {
      summary: long,
      recentTurns: [
        { role: "user" as const, text: long },
        { role: "assistant" as const, text: long },
        { role: "user" as const, text: "latest question" },
      ],
      memories: [long, long],
    };

    const roomy = formatSpeakSessionContext(input, 10_000);

    expect(roomy).toContain("latest question");
    expect(roomy.split("You: ").length).toBe(2);

    const tight = formatSpeakSessionContext(input, 260);

    expect(tight).toContain("Conversation so far:");
    expect(tight).not.toContain("Most recent exchange:");
    expect(tight).not.toContain("Things you remember");
    expect(tight.length).toBeLessThan(roomy.length);

    const minimal = formatSpeakSessionContext(input, 40);

    expect(minimal.startsWith("Conversation so far:")).toBe(true);
    expect(minimal.length).toBeLessThanOrEqual(40 * 4 + 24);
  });
});

function makeDeps(overrides: Partial<LoadSpeakSessionContextDeps> = {}): {
  deps: LoadSpeakSessionContextDeps;
  calls: { searches: Array<{ query: string; limit: number }> };
} {
  const calls = { searches: [] as Array<{ query: string; limit: number }> };
  const deps: LoadSpeakSessionContextDeps = {
    getConversationSummary: async () => ({ data: "Summary text", error: null }),
    getNMessages: async () => ({
      data: [
        { id: "s", role: "system", parts: [{ type: "text", text: "ignored" }] },
        { id: "u", role: "user", parts: [{ type: "text", text: "hello" }] },
        { id: "a", role: "assistant", parts: [{ type: "text", text: "" }] },
        { id: "a2", role: "assistant", parts: [{ type: "text", text: "hi back" }] },
      ],
      error: null,
    }),
    searchMemoriesWithL1Cache: async (_userId, query, limit) => {
      calls.searches.push({ query, limit });

      return {
        result: {
          data: {
            results: [
              { id: "m1", memory: "Likes tea", score: 0.9 },
              { id: "m2", memory: "Too weak", score: 0.1 },
            ],
          },
          error: null,
        },
        metrics: { cacheHit: false, memorySearchMs: 5 },
      };
    },
    ...overrides,
  };

  return { deps, calls };
}

describe("loadSpeakSessionContext", () => {
  test("skips system and empty turns and seeds memory search from the summary", async () => {
    const { deps, calls } = makeDeps();
    const ctx = await loadSpeakSessionContext(
      { ownerId: "owner", threadId: "thread", memoryEnabled: true },
      deps
    );

    expect(ctx.summary).toBe("Summary text");
    expect(ctx.recentTurns).toEqual([
      { role: "user", text: "hello" },
      { role: "assistant", text: "hi back" },
    ]);
    expect(ctx.memories).toEqual(["Likes tea"]);
    expect(calls.searches).toEqual([{ query: "Summary text", limit: SPEAK_CONTEXT_MEMORY_OVERFETCH }]);
  });

  test("does not touch memory when disabled", async () => {
    const { deps, calls } = makeDeps();
    const ctx = await loadSpeakSessionContext(
      { ownerId: "owner", threadId: "thread", memoryEnabled: false },
      deps
    );

    expect(ctx.memories).toEqual([]);
    expect(calls.searches).toEqual([]);
  });

  test("falls back to the last user turn as the seed when there is no summary", async () => {
    const { deps, calls } = makeDeps({
      getConversationSummary: async () => ({ data: null, error: null }),
    });

    await loadSpeakSessionContext({ ownerId: "owner", threadId: "thread", memoryEnabled: true }, deps);

    expect(calls.searches[0]?.query).toBe("hello");
  });

  test("tolerates data-layer failures", async () => {
    const { deps } = makeDeps({
      getConversationSummary: async () => ({ data: null, error: new Error("boom") }),
      getNMessages: async () => ({ data: [], error: "boom" }),
    });

    const ctx = await loadSpeakSessionContext(
      { ownerId: "owner", threadId: "thread", memoryEnabled: true },
      deps
    );

    expect(ctx).toEqual({ summary: null, recentTurns: [], memories: [] });
  });
});
