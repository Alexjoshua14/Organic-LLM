import { describe, expect, test } from "bun:test";

import type { MemoryItemType } from "@/lib/schemas/memory";
import type { UIMessage } from "ai";
import {
  hasPronounToken,
  mergeMemorySearchResultsByMaxScore,
  parseRewriterJson,
  rewriteMemoryQuery,
  shouldShortCircuitMemoryRewrite,
} from "@/lib/memory/query-rewriter";

function msg(role: "user" | "assistant", text: string, id: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

function twoTurns(): UIMessage[] {
  return [msg("user", "We discussed Mem0 yesterday.", "u1"), msg("assistant", "Noted.", "a1")];
}

describe("hasPronounToken", () => {
  test("detects it", () => {
    expect(hasPronounToken("expand on it")).toBe(true);
  });

  test("negative for standalone nouns", () => {
    expect(hasPronounToken("user preferences for dark mode")).toBe(false);
  });
});

describe("shouldShortCircuitMemoryRewrite", () => {
  const twoTurns = [msg("user", "hello", "1"), msg("assistant", "hi", "2")];

  test("short message no pronoun", () => {
    expect(shouldShortCircuitMemoryRewrite("ok thanks", twoTurns)).toBe(true);
  });

  test("clear long question", () => {
    expect(
      shouldShortCircuitMemoryRewrite(
        "what are the main differences between postgres and mysql for this project",
        twoTurns
      )
    ).toBe(true);
  });

  test("needs rewrite: pronoun with context", () => {
    expect(shouldShortCircuitMemoryRewrite("go deeper on that topic please", twoTurns)).toBe(false);
  });

  test("no prior turns", () => {
    expect(shouldShortCircuitMemoryRewrite("tell me more", [])).toBe(true);
  });
});

describe("parseRewriterJson", () => {
  test("parses raw json", () => {
    const r = parseRewriterJson('{"queries":["a","b"],"rationale":"x"}');

    expect(r).toEqual({ queries: ["a", "b"], rationale: "x" });
  });

  test("parses fenced", () => {
    const r = parseRewriterJson('```json\n{"queries":["q1"]}\n```');

    expect(r).toEqual({ queries: ["q1"] });
  });

  test("invalid returns null", () => {
    expect(parseRewriterJson("not json")).toBeNull();
  });
});

describe("mergeMemorySearchResultsByMaxScore", () => {
  test("keeps max score per id", () => {
    const a = (id: string, memory: string, score: number): MemoryItemType => ({
      id,
      memory,
      score,
    });

    const merged = mergeMemorySearchResultsByMaxScore([
      [a("1", "low", 0.2), a("2", "x", 0.5)],
      [a("1", "high", 0.9), a("3", "y", 0.4)],
    ]);

    expect(merged).toMatchSnapshot();
  });
});

describe("rewriteMemoryQuery", () => {
  test("timeout falls back to raw", async () => {
    const result = await rewriteMemoryQuery("tell me about the second option", twoTurns(), {
      enabled: true,
      timeoutMs: 30,
      generateTextImpl: () =>
        new Promise(() => {
          /* never resolves */
        }),
    });

    expect(result.usedRewrite).toBe(false);
    expect(result.queries).toEqual(["tell me about the second option"]);
  });

  test("mock generateText returns multi-query", async () => {
    const result = await rewriteMemoryQuery("tell me what they said about memory storage", twoTurns(), {
      enabled: true,
      generateTextImpl: async () => ({
        text: '{"queries":["user memory preferences","Mem0 vector search setup"],"rationale":"split"}',
      }),
    });

    expect(result.usedRewrite).toBe(true);
    expect(result.queries).toEqual(["user memory preferences", "Mem0 vector search setup"]);
  });
});
