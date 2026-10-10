import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  clearCondensedMemoryCache,
  condenseActivatedMemories,
  isActivatedMemoryCondenseEnabled,
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

  test("stops at the shared deadline and keeps the clip for late answers", async () => {
    const hung: CondenseMemoryText = () => new Promise(() => {});
    const start = performance.now();
    const result = await condenseActivatedMemories([long("a"), long("b")], {
      maxChars: 50,
      condense: hung,
      budgetMs: 50,
    });

    expect(performance.now() - start).toBeLessThan(1_000);
    expect(result.condensed).toBe(0);
    expect(result.memories.every((memory) => memory.text.endsWith("…"))).toBe(true);
  });

  test("passes the deadline signal to the condenser", async () => {
    let signal: AbortSignal | undefined;
    const condense: CondenseMemoryText = async (_text, _max, abortSignal) => {
      signal = abortSignal;

      return "Condensed fact.";
    };

    await condenseActivatedMemories([long("a")], { maxChars: 50, condense, budgetMs: 50 });

    expect(signal).toBeInstanceOf(AbortSignal);
  });

  test("sends at most maxCondensed memories per turn", async () => {
    let calls = 0;
    const condense: CondenseMemoryText = async () => {
      calls++;

      return "Condensed fact.";
    };
    const result = await condenseActivatedMemories([long("a"), long("b"), long("c")], {
      maxChars: 50,
      condense,
      maxCondensed: 2,
    });

    expect(calls).toBe(2);
    expect(result.condensed).toBe(2);
    expect(result.memories[2]!.text.endsWith("…")).toBe(true);
  });
});

describe("isActivatedMemoryCondenseEnabled", () => {
  const original = process.env.ACTIVATED_MEMORY_CONDENSE_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.ACTIVATED_MEMORY_CONDENSE_ENABLED;
    else process.env.ACTIVATED_MEMORY_CONDENSE_ENABLED = original;
  });

  test("is on by default and off only for an explicit false", () => {
    delete process.env.ACTIVATED_MEMORY_CONDENSE_ENABLED;
    expect(isActivatedMemoryCondenseEnabled()).toBe(true);

    process.env.ACTIVATED_MEMORY_CONDENSE_ENABLED = "true";
    expect(isActivatedMemoryCondenseEnabled()).toBe(true);

    process.env.ACTIVATED_MEMORY_CONDENSE_ENABLED = "false";
    expect(isActivatedMemoryCondenseEnabled()).toBe(false);
  });
});
