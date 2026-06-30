import { describe, expect, test } from "bun:test";

import {
  MEMORY_INGEST_DEFAULT_MEMORIES_ON,
  MEMORY_INGEST_MEMORIES_STORAGE_KEY,
  resolveInitialMemoriesOn,
} from "@/lib/chat/memories-default";

describe("Memory ingest composer memory default", () => {
  test("memory is enabled by default on the memory-ingest page (no stored pref)", () => {
    // What the chamber actually wires into CoreInput.
    const resolved = resolveInitialMemoriesOn(null, MEMORY_INGEST_DEFAULT_MEMORIES_ON);

    expect(resolved).toBe(true);
  });

  test("chamber config: default-on and a scoped (non-global) storage key", () => {
    expect(MEMORY_INGEST_DEFAULT_MEMORIES_ON).toBe(true);
    // Must not be the global key, or enabling it here would leak into main chat.
    expect(MEMORY_INGEST_MEMORIES_STORAGE_KEY).not.toBe("organic-llm-memories");
  });

  test("an explicit user choice always overrides the default", () => {
    // User turned memory off in the chamber → stays off despite default-on.
    expect(resolveInitialMemoriesOn("false", MEMORY_INGEST_DEFAULT_MEMORIES_ON)).toBe(false);
    // User turned memory on elsewhere with a default-off surface → stays on.
    expect(resolveInitialMemoriesOn("true", false)).toBe(true);
  });

  test("a default-off surface (e.g. main chat) stays off with no stored pref", () => {
    expect(resolveInitialMemoriesOn(null, false)).toBe(false);
  });
});
