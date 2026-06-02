import { describe, expect, test } from "bun:test";

import {
  DELPHI_MEMORY_TEXT_MAX,
  commitMemoryInputSchema,
  proposeMemoryInputSchema,
} from "@/lib/llm/delphi-memory-tool-schemas";

describe("Delphi memory tool schemas", () => {
  test("propose_memory accepts valid payload", () => {
    const r = proposeMemoryInputSchema.safeParse({ text: "User prefers tea." });

    expect(r.success).toBe(true);
  });

  test("propose_memory rejects text over max", () => {
    const r = proposeMemoryInputSchema.safeParse({ text: "x".repeat(DELPHI_MEMORY_TEXT_MAX + 1) });

    expect(r.success).toBe(false);
  });

  test("commit_memory accepts topic", () => {
    const r = commitMemoryInputSchema.safeParse({ text: "Canonical fact.", topic: "prefs" });

    expect(r.success).toBe(true);
  });
});
