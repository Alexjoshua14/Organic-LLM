import { describe, expect, test } from "bun:test";

import {
  MODEL_PLAN_PROMPT,
  MODEL_RESEARCH_PROMPT,
  MODEL_SELECT_BEAT_ID,
  SHOWCASE_FROM_MODEL_ID,
  SHOWCASE_TO_MODEL_ID,
  deriveModelFrame,
  modelFacts,
  modelSelectionScript,
  showcaseSelectableModels,
} from "@/lib/showcase/models-and-usage/script";
import { getSelectableChatModels } from "@/lib/schemas/chat-models";

describe("showcase model selection script", () => {
  test("content runs about ten seconds, then a short end hold", () => {
    expect(modelSelectionScript.contentEndMs).toBeGreaterThanOrEqual(8_000);
    expect(modelSelectionScript.contentEndMs).toBeLessThanOrEqual(12_000);
    expect(modelSelectionScript.durationMs - modelSelectionScript.contentEndMs).toBe(1_200);
    expect(modelSelectionScript.chapters.map((chapter) => chapter.title)).toEqual([
      "Quick question",
      "Big plan",
    ]);
  });

  test("the quick question uses the fast model and the plan switches to the stronger one", () => {
    const research = deriveModelFrame(modelSelectionScript, 0);
    const select = modelSelectionScript.beats.find((beat) => beat.id === MODEL_SELECT_BEAT_ID)!;
    const atSelectStart = deriveModelFrame(modelSelectionScript, select.startMs);
    const atSelectEnd = deriveModelFrame(modelSelectionScript, select.endMs - 1);

    expect(research).toMatchObject({ modelId: SHOWCASE_FROM_MODEL_ID, prompt: MODEL_RESEARCH_PROMPT });
    expect(atSelectStart.modelId).toBe(SHOWCASE_FROM_MODEL_ID);
    expect(atSelectEnd).toMatchObject({ modelId: SHOWCASE_TO_MODEL_ID, prompt: MODEL_PLAN_PROMPT });
    expect(SHOWCASE_FROM_MODEL_ID).not.toBe(SHOWCASE_TO_MODEL_ID);
  });

  test("every chapter's settled frame shows its own model", () => {
    const [research, plan] = modelSelectionScript.chapters;

    expect(deriveModelFrame(modelSelectionScript, research!.endMs - 1).modelId).toBe(
      SHOWCASE_FROM_MODEL_ID
    );
    expect(deriveModelFrame(modelSelectionScript, plan!.endMs - 1).modelId).toBe(
      SHOWCASE_TO_MODEL_ID
    );
  });

  test("scripted ids come from the non-admin selectable list", () => {
    const selectable = getSelectableChatModels(false);

    expect(showcaseSelectableModels.map((model) => model.id)).toEqual(
      selectable.map((model) => model.id)
    );
    expect(selectable.some((model) => model.id === SHOWCASE_FROM_MODEL_ID)).toBe(true);
    expect(selectable.some((model) => model.id === SHOWCASE_TO_MODEL_ID)).toBe(true);
    expect(selectable.every((model) => !model.adminOnly)).toBe(true);
  });
});

describe("modelFacts", () => {
  test("describes every selectable model without pricing or plan information", () => {
    for (const model of showcaseSelectableModels) {
      const facts = modelFacts(model);

      expect(facts.provider.length).toBeGreaterThan(0);
      expect(facts.contextWindow).toMatch(/^\d+(\.\d+)?[kM]$/);
      expect(Object.keys(facts).sort()).toEqual(["contextWindow", "provider", "zeroDataRetention"]);
    }
  });

  test("names the provider and formats the window", () => {
    expect(modelFacts({ id: "anthropic/claude-sonnet-5", supportsZeroDataRetention: true })).toEqual({
      provider: "Anthropic",
      contextWindow: "1M",
      zeroDataRetention: true,
    });
    expect(modelFacts({ id: "openai/some-model" })).toMatchObject({
      provider: "OpenAI",
      contextWindow: "128k",
      zeroDataRetention: false,
    });
  });
});
