import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import { addUsage, emptyDemoUsage } from "@/lib/sandbox/noesis/demo/types";
import { computeDemoVersionHash } from "@/lib/sandbox/noesis/demo/version";
import { getAuthoredSpark, listAuthoredSparks } from "@/lib/sandbox/noesis/sparks/registry";

describe("noesis authored sparks registry", () => {
  test("has at least one spark, each with all required fields", () => {
    const sparks = listAuthoredSparks();

    expect(sparks.length).toBeGreaterThan(0);
    for (const s of sparks) {
      expect(s.id.trim().length).toBeGreaterThan(0);
      expect(s.slug.trim().length).toBeGreaterThan(0);
      expect(s.userFacingText.trim().length).toBeGreaterThan(0);
      expect(s.systemPrompt.trim().length).toBeGreaterThan(0);
      expect(s.demoKickoff.trim().length).toBeGreaterThan(0);
      expect(typeof s.createdAt).toBe("string");
    }
  });

  test("spark ids are unique", () => {
    const ids = listAuthoredSparks().map((s) => s.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("getAuthoredSpark resolves by id and misses cleanly", () => {
    const first = listAuthoredSparks()[0]!;

    expect(getAuthoredSpark(first.id)?.id).toBe(first.id);
    expect(getAuthoredSpark("does-not-exist")).toBeUndefined();
  });
});

describe("demo usage math", () => {
  test("emptyDemoUsage is zeroed", () => {
    expect(emptyDemoUsage()).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  test("addUsage sums fields; falls back to input+output when total missing", () => {
    let u = emptyDemoUsage();

    u = addUsage(u, { inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(u).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });

    u = addUsage(u, { inputTokens: 3, outputTokens: 4 }); // no total → 7
    expect(u).toEqual({ inputTokens: 13, outputTokens: 9, totalTokens: 22 });
  });

  test("addUsage coerces null/undefined/NaN to 0", () => {
    const u = addUsage(emptyDemoUsage(), {
      inputTokens: null,
      outputTokens: undefined,
      totalTokens: Number.NaN,
    });

    expect(u).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });
});

describe("computeDemoVersionHash", () => {
  const base = {
    systemPrompt: "You are a tester.",
    kickoff: "hi",
    model: "google/gemini-3-flash",
    cycles: 3,
    npcPersonaVersion: "npc-v1",
  };

  test("is stable for identical inputs", () => {
    expect(computeDemoVersionHash(base)).toBe(computeDemoVersionHash({ ...base }));
  });

  test("ignores surrounding whitespace in prompt/kickoff (revert-to-version hits cache)", () => {
    expect(computeDemoVersionHash(base)).toBe(
      computeDemoVersionHash({ ...base, systemPrompt: "  You are a tester.  ", kickoff: " hi " })
    );
  });

  test("changes when any salient input changes", () => {
    const h = computeDemoVersionHash(base);

    expect(computeDemoVersionHash({ ...base, systemPrompt: "different" })).not.toBe(h);
    expect(computeDemoVersionHash({ ...base, kickoff: "different" })).not.toBe(h);
    expect(computeDemoVersionHash({ ...base, model: "openai/gpt-5.4-nano" })).not.toBe(h);
    expect(computeDemoVersionHash({ ...base, cycles: 2 })).not.toBe(h);
    expect(computeDemoVersionHash({ ...base, npcPersonaVersion: "npc-v2" })).not.toBe(h);
  });

  test("returns a 64-char hex sha256", () => {
    expect(computeDemoVersionHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
