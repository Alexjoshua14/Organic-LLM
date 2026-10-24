import { describe, expect, test } from "bun:test";

import {
  appendSessionFiled,
  filterSessionFiledByWindow,
  parseMemoryCommitFailed,
  parseMemoryCommitted,
  removeSessionFiled,
  sessionFiledStorageKey,
} from "@/app/sandbox/prototypes/memory-ingest/_lib/memory-ingest-filed";
import { MEMORY_INGEST_RESUME_WINDOW_MS } from "@/lib/chat/memory-ingest";

import type { FiledMemory } from "@/app/sandbox/prototypes/memory-ingest/_lib/memory-ingest-filed";

function sampleFiled(overrides: Partial<FiledMemory> = {}): FiledMemory {
  return {
    id: "mem_1",
    text: "Prefers tea",
    topic: "prefs",
    ts: 1_700_000_000_000,
    ...overrides,
  };
}

describe("parseMemoryCommitted", () => {
  test("parses a data-memoryCommitted part into a FiledMemory (trimmed)", () => {
    const filed = parseMemoryCommitted({
      type: "data-memoryCommitted",
      data: { id: "mem_123", text: "  Prefers Bun over npm  ", topic: " tooling " },
    });

    expect(filed).not.toBeNull();
    expect(filed?.id).toBe("mem_123");
    expect(filed?.text).toBe("Prefers Bun over npm");
    expect(filed?.topic).toBe("tooling");
    expect(typeof filed?.ts).toBe("number");
  });

  test("id is null when the store returned none (Undo then unavailable)", () => {
    const filed = parseMemoryCommitted({
      type: "data-memoryCommitted",
      data: { id: null, text: "Born in Auckland" },
    });

    expect(filed?.id).toBeNull();
    expect(filed?.topic).toBeUndefined();
  });

  test("returns null without real saved text", () => {
    expect(
      parseMemoryCommitted({ type: "data-memoryCommitted", data: { id: "x", text: "   " } })
    ).toBeNull();
    expect(parseMemoryCommitted({ type: "data-memoryCommitted", data: {} })).toBeNull();
  });

  test("ignores unrelated or malformed stream parts", () => {
    expect(parseMemoryCommitted({ type: "data-aiAction", data: { action: "memory" } })).toBeNull();
    expect(parseMemoryCommitted(null)).toBeNull();
    expect(parseMemoryCommitted("nope")).toBeNull();
  });
});

describe("parseMemoryCommitFailed", () => {
  test("parses a data-memoryCommitFailed part", () => {
    const failed = parseMemoryCommitFailed({
      type: "data-memoryCommitFailed",
      data: { text: "Alex, Noe Valley", topic: "location", error: "Too many memory add requests" },
    });

    expect(failed).not.toBeNull();
    expect(failed?.text).toBe("Alex, Noe Valley");
    expect(failed?.topic).toBe("location");
    expect(failed?.error).toBe("Too many memory add requests");
    expect(typeof failed?.ts).toBe("number");
  });

  test("returns null without text or error", () => {
    expect(
      parseMemoryCommitFailed({
        type: "data-memoryCommitFailed",
        data: { text: "x", error: "   " },
      })
    ).toBeNull();
    expect(parseMemoryCommitFailed({ type: "data-memoryCommitted", data: {} })).toBeNull();
  });
});

describe("session filed helpers", () => {
  test("sessionFiledStorageKey scopes by chat id", () => {
    expect(sessionFiledStorageKey("chat-a")).toBe("memory-ingest-filed:chat-a");
  });

  test("appendSessionFiled prepends and dedupes by id", () => {
    const a = sampleFiled({ id: "mem_a", text: "first", ts: 100 });
    const b = sampleFiled({ id: "mem_b", text: "second", ts: 200 });
    const updated = sampleFiled({ id: "mem_a", text: "first revised", ts: 300 });

    const once = appendSessionFiled([a], b);

    expect(once).toHaveLength(2);
    expect(once[0]?.id).toBe("mem_b");

    const twice = appendSessionFiled(once, updated);

    expect(twice).toHaveLength(2);
    expect(twice[0]?.text).toBe("first revised");
    expect(twice.filter((m) => m.id === "mem_a")).toHaveLength(1);
  });

  test("appendSessionFiled dedupes id-less filings by ts", () => {
    const a = sampleFiled({ id: null, text: "orphan", ts: 42 });
    const sameTs = sampleFiled({ id: null, text: "orphan again", ts: 42 });

    const next = appendSessionFiled([a], sameTs);

    expect(next).toHaveLength(1);
    expect(next[0]?.text).toBe("orphan again");
  });

  test("removeSessionFiled drops by Mem0 id", () => {
    const items = [
      sampleFiled({ id: "mem_a" }),
      sampleFiled({ id: "mem_b", text: "keep me" }),
    ];

    expect(removeSessionFiled(items, "mem_a")).toEqual([items[1]]);
  });

  test("filterSessionFiledByWindow drops stale filings", () => {
    const now = 2_000_000_000_000;
    const fresh = sampleFiled({ ts: now - 1_000 });
    const stale = sampleFiled({
      id: "old",
      ts: now - MEMORY_INGEST_RESUME_WINDOW_MS - 1,
    });

    const filtered = filterSessionFiledByWindow([fresh, stale], now);

    expect(filtered).toEqual([fresh]);
  });
});
