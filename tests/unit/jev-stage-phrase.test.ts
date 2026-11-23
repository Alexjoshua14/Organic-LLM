import { describe, expect, test } from "bun:test";

import { JEV_STAGE_PHRASE_CONTEXT_CHARS } from "@/lib/jev-stage/constants";
import { directToolNeedsPhrase, leanPhraseContext } from "@/lib/jev-stage/phrase";

describe("jev-stage phrase hop helpers", () => {
  test("only lookup directs need a phrase callback", () => {
    expect(directToolNeedsPhrase("recall")).toBe(true);
    expect(directToolNeedsPhrase("memory_search")).toBe(true);
    expect(directToolNeedsPhrase("web_search")).toBe(true);
    expect(directToolNeedsPhrase("orchestrate")).toBe(false);
    expect(directToolNeedsPhrase("specialists")).toBe(false);
  });

  test("leanPhraseContext stays inside the token budget cap", () => {
    const context = leanPhraseContext("recall", {
      query: "What do you know about me?",
      items: Array.from({ length: 20 }, (_, index) => `memory-${index}-${"x".repeat(200)}`),
    });

    expect(context.length).toBeLessThanOrEqual(JEV_STAGE_PHRASE_CONTEXT_CHARS);
    expect(context).toContain("recall");
  });
});
