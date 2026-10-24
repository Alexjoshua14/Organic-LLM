import { describe, expect, test } from "bun:test";

import type { MemoryItemType } from "@/lib/schemas/memory";

import {
  filterMemoriesSince,
  LIST_RECENT_MEMORIES_MAX,
  memoryActivityAt,
  recentMemoryWindowSinceMs,
} from "@/lib/memory/recent-memories";

function mem(partial: Partial<MemoryItemType> & { id: string; memory: string }): MemoryItemType {
  return {
    id: partial.id,
    memory: partial.memory,
    createdAt: partial.createdAt,
    updatedAt: partial.updatedAt,
    score: partial.score,
  };
}

describe("memoryActivityAt", () => {
  test("prefers createdAt over updatedAt", () => {
    expect(
      memoryActivityAt({
        createdAt: "2026-09-21T12:00:00.000Z",
        updatedAt: "2026-09-21T18:00:00.000Z",
      })
    ).toBe(Date.parse("2026-09-21T12:00:00.000Z"));
  });

  test("falls back to updatedAt", () => {
    expect(memoryActivityAt({ updatedAt: "2026-09-21T12:00:00.000Z" })).toBe(
      Date.parse("2026-09-21T12:00:00.000Z")
    );
  });

  test("returns null without a parseable timestamp", () => {
    expect(memoryActivityAt({})).toBeNull();
    expect(memoryActivityAt({ createdAt: "not-a-date" })).toBeNull();
  });
});

describe("filterMemoriesSince", () => {
  const now = Date.parse("2026-09-21T18:00:00.000Z");
  const sinceHour = recentMemoryWindowSinceMs("hour", now);

  test("keeps only memories in the window, newest first", () => {
    const items = [
      mem({
        id: "old",
        memory: "old fact",
        createdAt: "2026-09-20T10:00:00.000Z",
      }),
      mem({
        id: "mid",
        memory: "mid fact",
        createdAt: "2026-09-21T17:30:00.000Z",
      }),
      mem({
        id: "new",
        memory: "new fact",
        createdAt: "2026-09-21T17:50:00.000Z",
      }),
      mem({ id: "undated", memory: "no dates" }),
    ];

    const filtered = filterMemoriesSince(items, sinceHour);

    expect(filtered.map((m) => m.id)).toEqual(["new", "mid"]);
  });

  test("caps the return set", () => {
    const items = Array.from({ length: LIST_RECENT_MEMORIES_MAX + 5 }, (_, i) =>
      mem({
        id: `m${i}`,
        memory: `fact ${i}`,
        createdAt: new Date(now - i * 1000).toISOString(),
      })
    );

    const filtered = filterMemoriesSince(items, sinceHour, LIST_RECENT_MEMORIES_MAX);

    expect(filtered).toHaveLength(LIST_RECENT_MEMORIES_MAX);
    expect(filtered[0]?.id).toBe("m0");
  });
});

describe("recentMemoryWindowSinceMs", () => {
  test("hour and day offsets", () => {
    const now = 1_000_000_000_000;

    expect(recentMemoryWindowSinceMs("hour", now)).toBe(now - 3_600_000);
    expect(recentMemoryWindowSinceMs("day", now)).toBe(now - 86_400_000);
  });
});
