import { describe, expect, test } from "bun:test";

import { getModelContextWindowTokens, segmentTokens } from "@/lib/chat/context-budget";
import { CONTEXT_EFFORT_BUDGETS } from "@/lib/memory/context-effort";
import {
  CONTEXT_DEMO_MODEL_ID,
  contextControlsScript,
  contextDemoBeatEffort,
  contextDemoBudget,
  contextDemoMemories,
  deriveContextDemo,
} from "@/lib/showcase/context-controls";
import { SHOWCASE_STORY } from "@/lib/showcase/showcase-story";
import { getSelectableChatModels } from "@/lib/schemas/chat";

describe("contextDemoBudget", () => {
  test("quick and heavy memory tokens differ, and heavy is larger", () => {
    const quick = segmentTokens(contextDemoBudget("quick"), "memory");
    const heavy = segmentTokens(contextDemoBudget("heavy"), "memory");

    expect(quick).toBe(CONTEXT_EFFORT_BUDGETS.quick.combinedTokenCap);
    expect(heavy).toBe(CONTEXT_EFFORT_BUDGETS.heavy.combinedTokenCap);
    expect(heavy).toBeGreaterThan(quick);
    expect(segmentTokens(contextDemoBudget("instant"), "memory")).toBe(
      CONTEXT_EFFORT_BUDGETS.instant.combinedTokenCap
    );
  });

  test("heavy includes every story memory and instant includes fewer", () => {
    expect(contextDemoMemories("heavy")).toEqual([...SHOWCASE_STORY.memories]);
    expect(contextDemoMemories("instant").length).toBeLessThan(SHOWCASE_STORY.memories.length);
    expect(contextDemoMemories("instant")).toEqual([SHOWCASE_STORY.memories[0]]);
    expect(contextDemoMemories("quick")).toEqual(SHOWCASE_STORY.memories.slice(0, 2));
  });

  test("finalizeContextBudget result has fillRatio in (0, 1) and a memory segment", () => {
    for (const effort of ["instant", "quick", "heavy"] as const) {
      const budget = contextDemoBudget(effort);
      const memory = budget.segments.find((segment) => segment.id === "memory");

      expect(budget.fillRatio).toBeGreaterThan(0);
      expect(budget.fillRatio).toBeLessThan(1);
      expect(memory).toBeDefined();
      expect(memory!.tokens).toBeGreaterThan(0);
    }

    const quick = contextDemoBudget("quick");
    const heavy = contextDemoBudget("heavy");

    expect(Math.round(heavy.fillRatio * 100)).toBeGreaterThan(Math.round(quick.fillRatio * 100));
    expect(quick.segments.map((segment) => segment.id)).toEqual(
      expect.arrayContaining(["system", "messages", "tools", "memory"])
    );
  });

  test("uses a selectable model with a known context window", () => {
    const budget = contextDemoBudget("quick");

    expect(getSelectableChatModels(false).some((model) => model.id === CONTEXT_DEMO_MODEL_ID)).toBe(
      true
    );
    expect(budget.modelId).toBe(CONTEXT_DEMO_MODEL_ID);
    expect(getModelContextWindowTokens(budget.modelId)).toBeGreaterThan(0);
  });
});

describe("deriveContextDemo", () => {
  test("script content ends between 8s and 12s", () => {
    expect(contextControlsScript.contentEndMs).toBeGreaterThanOrEqual(8_000);
    expect(contextControlsScript.contentEndMs).toBeLessThanOrEqual(12_000);
    expect(contextControlsScript.chapters.map((chapter) => chapter.id)).toEqual([
      "inspect",
      "effort",
    ]);
    expect(contextControlsScript.beats.map((beat) => contextDemoBeatEffort(beat.id))).toEqual([
      "quick",
      "heavy",
    ]);
  });

  test("inspect holds Quick and the effort chapter arrives at Heavy", () => {
    const opening = deriveContextDemo(0);
    const finished = deriveContextDemo(contextControlsScript.contentEndMs);
    const heavyBeat = contextControlsScript.beats.find((beat) => beat.id === "heavy")!;
    const mid = deriveContextDemo(
      heavyBeat.startMs + (heavyBeat.endMs - heavyBeat.startMs) * 0.55
    );

    expect(opening.effort).toBe("quick");
    expect(opening.memories).toEqual(contextDemoMemories("quick"));
    expect(segmentTokens(opening.budget, "memory")).toBe(
      segmentTokens(contextDemoBudget("quick"), "memory")
    );

    expect(finished.effort).toBe("heavy");
    expect(finished.memories).toEqual([...SHOWCASE_STORY.memories]);
    expect(segmentTokens(finished.budget, "memory")).toBe(
      segmentTokens(contextDemoBudget("heavy"), "memory")
    );

    const midTokens = segmentTokens(mid.budget, "memory");

    expect(mid.effort).toBe("heavy");
    expect(midTokens).toBeGreaterThan(segmentTokens(contextDemoBudget("quick"), "memory"));
    expect(midTokens).toBeLessThan(segmentTokens(contextDemoBudget("heavy"), "memory"));
    expect(mid.memories.length).toBeGreaterThan(contextDemoMemories("quick").length);
  });

  test("does not call fetch", () => {
    const original = globalThis.fetch;

    globalThis.fetch = () => {
      throw new Error("context controls demo must not fetch");
    };

    try {
      contextDemoBudget("instant");
      contextDemoBudget("quick");
      contextDemoBudget("heavy");
      deriveContextDemo(0);
      deriveContextDemo(contextControlsScript.contentEndMs);
    } finally {
      globalThis.fetch = original;
    }
  });
});
