import { describe, expect, test } from "bun:test";

import {
  SHOWCASE_USAGE_BY_PERIOD,
  SHOWCASE_USAGE_DEFAULT_PERIOD,
  assertShowcaseUsagePayload,
} from "@/lib/showcase/models-and-usage/payloads";
import {
  MODELS_USAGE_SELECT_BEAT_ID,
  SHOWCASE_FROM_MODEL_ID,
  SHOWCASE_TO_MODEL_ID,
  deriveModelsUsageFrame,
  modelsUsageScript,
  showcaseSelectableModels,
} from "@/lib/showcase/models-and-usage/script";
import { getSelectableChatModels } from "@/lib/schemas/chat-models";
import type { UsageRangePreset } from "@/lib/usage/aggregate";

const PRESETS: UsageRangePreset[] = ["7d", "30d", "90d"];

describe("showcase models and usage payloads", () => {
  test("each period type-checks and its totals match the bundled series", () => {
    for (const preset of PRESETS) {
      const payload = SHOWCASE_USAGE_BY_PERIOD[preset];

      expect(() => assertShowcaseUsagePayload(payload)).not.toThrow();
      expect(payload.range.preset).toBe(preset);

      const dailyTokens = payload.daily.reduce((sum, day) => sum + day.totalTokens, 0);

      expect(payload.totals.totalTokens).toBe(dailyTokens);
      expect(payload.totals.inputTokens + payload.totals.outputTokens).toBe(
        payload.totals.totalTokens
      );

      const modelCost = payload.byModel.reduce((sum, row) => sum + row.costUsd, 0);

      expect(Math.abs(modelCost - payload.totals.costUsd)).toBeLessThanOrEqual(0.01);

      const modelTokens = payload.byModel.reduce((sum, row) => sum + row.totalTokens, 0);

      expect(modelTokens).toBe(payload.totals.totalTokens);

      for (const allotment of payload.planAllotments) {
        expect(typeof allotment.plan.id).toBe("string");
        expect(typeof allotment.plan.name).toBe("string");
      }
    }
  });

  test("longer ranges include more of the same fictional stretch", () => {
    const week = SHOWCASE_USAGE_BY_PERIOD["7d"].totals.totalTokens;
    const month = SHOWCASE_USAGE_BY_PERIOD["30d"].totals.totalTokens;
    const quarter = SHOWCASE_USAGE_BY_PERIOD["90d"].totals.totalTokens;

    expect(week).toBeLessThan(month);
    expect(month).toBeLessThan(quarter);
    expect(SHOWCASE_USAGE_DEFAULT_PERIOD).toBe("30d");
    expect(SHOWCASE_USAGE_BY_PERIOD["7d"].daily).toHaveLength(7);
    expect(SHOWCASE_USAGE_BY_PERIOD["90d"].daily.length).toBeLessThan(30);
  });

  test("both scripted models appear in every breakdown", () => {
    for (const preset of PRESETS) {
      const ids = SHOWCASE_USAGE_BY_PERIOD[preset].byModel.map((row) => row.modelId);

      expect(ids).toContain(SHOWCASE_FROM_MODEL_ID);
      expect(ids).toContain(SHOWCASE_TO_MODEL_ID);
    }
  });
});

describe("showcase models and usage script", () => {
  test("content runs about ten seconds, then a short end hold", () => {
    expect(modelsUsageScript.contentEndMs).toBeGreaterThanOrEqual(8_000);
    expect(modelsUsageScript.contentEndMs).toBeLessThanOrEqual(12_000);
    expect(modelsUsageScript.durationMs - modelsUsageScript.contentEndMs).toBe(1_200);
    expect(modelsUsageScript.chapters.map((chapter) => chapter.title)).toEqual(["Model", "Usage"]);
  });

  test("the selection beat changes the model, and the usage chapter shows the panel", () => {
    const chapter0 = deriveModelsUsageFrame(
      modelsUsageScript,
      modelsUsageScript.chapters[0]!.startMs
    );
    const selectBeat = modelsUsageScript.beats.find(
      (beat) => beat.id === MODELS_USAGE_SELECT_BEAT_ID
    );

    expect(selectBeat).toBeDefined();

    const atSelectionStart = deriveModelsUsageFrame(modelsUsageScript, selectBeat!.startMs);
    const atSelectionEnd = deriveModelsUsageFrame(modelsUsageScript, selectBeat!.endMs - 1);
    const usage = deriveModelsUsageFrame(modelsUsageScript, modelsUsageScript.chapters[1]!.startMs);

    expect(chapter0.modelId).toBe(SHOWCASE_FROM_MODEL_ID);
    expect(chapter0.modelId).not.toBe(atSelectionEnd.modelId);
    expect(atSelectionStart.modelId).toBe(SHOWCASE_FROM_MODEL_ID);
    expect(atSelectionEnd.modelId).toBe(SHOWCASE_TO_MODEL_ID);
    expect(chapter0.showUsage).toBe(false);
    expect(usage.showUsage).toBe(true);
    expect(usage.modelId).toBe(SHOWCASE_TO_MODEL_ID);
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
