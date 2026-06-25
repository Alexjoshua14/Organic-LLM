import { describe, expect, test } from "bun:test";

import { parseMemoryCommitted } from "@/app/sandbox/prototypes/memory-ingest/_lib/memory-ingest-filed";

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
