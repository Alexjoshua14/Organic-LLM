import { beforeEach, describe, expect, test } from "bun:test";

import {
  clearCondensedMemoryCache,
  condenseActivatedMemories,
  type CondenseMemoryText,
} from "@/lib/memory/condense-activated-memories";

const long = (id: string) => ({ id, text: `${id} ${"detail ".repeat(20)}`.trim() });

beforeEach(() => clearCondensedMemoryCache());

describe("condenseActivatedMemories", () => {
  test("only sends memories over the cap, and passes short ones through", async () => {
    const seen: string[] = [];
    const condense: CondenseMemoryText = async (text) => {
      seen.push(text);

      return "Condensed fact.";
    };
    const short = { id: "s", text: "Short fact." };
    const result = await condenseActivatedMemories([short, long("a")], { maxChars: 50, condense });

    expect(seen).toHaveLength(1);
    expect(result.condensed).toBe(1);
    expect(result.memories).toEqual([short, { id: "a", text: "Condensed fact." }]);
  });

  test("clips an over-long answer and normalizes whitespace", async () => {
    const condense: CondenseMemoryText = async () => `  ${"word ".repeat(30)}\n\n`;
    const result = await condenseActivatedMemories([long("a")], { maxChars: 50, condense });

    expect(result.memories[0]!.text.length).toBeLessThanOrEqual(50);
    expect(result.memories[0]!.text).not.toContain("\n");
    expect(result.condensed).toBe(1);
  });

  test("falls back to the deterministic clip on an error or empty answer", async () => {
    const failing: CondenseMemoryText = async () => {
      throw new Error("gateway down");
    };
    const empty: CondenseMemoryText = async () => "   ";

    for (const condense of [failing, empty]) {
      const result = await condenseActivatedMemories([long("a")], { maxChars: 50, condense });

      expect(result.condensed).toBe(0);
      expect(result.memories[0]!.text.endsWith("…")).toBe(true);
      expect(result.memories[0]!.text.length).toBeLessThanOrEqual(50);
    }
  });

  test("reuses a condensed memory instead of calling again", async () => {
    let calls = 0;
    const condense: CondenseMemoryText = async () => {
      calls++;

      return "Condensed fact.";
    };

    await condenseActivatedMemories([long("a")], { maxChars: 50, condense });
    const again = await condenseActivatedMemories([long("a")], { maxChars: 50, condense });

    expect(calls).toBe(1);
    expect(again.memories[0]!.text).toBe("Condensed fact.");
  });
});
