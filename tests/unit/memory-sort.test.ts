import { describe, expect, test } from "bun:test";
import type { MemoryItem } from "mem0ai/oss";

import { sortMemories } from "@/lib/memory/sort-memories";

const memories: MemoryItem[] = [
  {
    id: "older-relevant",
    memory: "Tea preference",
    createdAt: "2026-09-01T12:00:00Z",
    score: 0.95,
  },
  { id: "newer", memory: "Coffee preference", createdAt: "2026-09-24T12:00:00Z", score: 0.2 },
  { id: "unknown", memory: "No date or score" },
];

describe("memory lens sorting", () => {
  test("relevance orders highest scores first and missing scores last without mutating results", () => {
    const input = [...memories].reverse();
    const original = [...input];

    expect(sortMemories(input, "relevance").map((m) => m.id)).toEqual([
      "older-relevant",
      "newer",
      "unknown",
    ]);
    expect(input).toEqual(original);
  });

  test("recency uses creation time, not update time or relevance", () => {
    const input = memories.map((m) => ({ ...m, updatedAt: "2026-10-01T00:00:00Z" }));

    expect(sortMemories(input, "recently-added").map((m) => m.id)).toEqual([
      "newer",
      "older-relevant",
      "unknown",
    ]);
    expect(input.map((m) => m.id)).toEqual(memories.map((m) => m.id));
  });

  test("invalid timestamps and non-finite scores sort after usable values", () => {
    const input: MemoryItem[] = [
      { id: "invalid", memory: "Malformed metadata", createdAt: "not-a-date", score: Number.NaN },
      ...memories,
    ];

    expect(sortMemories(input, "recently-added").map((m) => m.id)).toEqual([
      "newer",
      "older-relevant",
      "invalid",
      "unknown",
    ]);
    expect(sortMemories(input, "relevance").map((m) => m.id)).toEqual([
      "older-relevant",
      "newer",
      "invalid",
      "unknown",
    ]);
  });

  test("equal values preserve backend order and empty lists are valid", () => {
    const input = memories.map((m) => ({ ...m, score: 0.5, createdAt: "2026-09-24T00:00:00Z" }));

    expect(sortMemories(input, "recently-added")).toEqual(input);
    expect(sortMemories(input, "relevance")).toEqual(input);
    expect(sortMemories([], "relevance")).toEqual([]);
  });
});
