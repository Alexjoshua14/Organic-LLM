import { describe, expect, test } from "bun:test";

import {
  buildEffortProviderOptions,
  clampEffortForModel,
  getEffortLevelsForModel,
  modelSupportsEffortControl,
} from "@/lib/schemas/chat-effort";

describe("getEffortLevelsForModel", () => {
  test("GPT-5.6 exposes none through max (no minimal)", () => {
    const ids = getEffortLevelsForModel("openai/gpt-5.6-sol").map((r) => r.id);

    expect(ids).toEqual(["auto", "none", "low", "medium", "high", "xhigh", "max"]);
  });

  test("GPT-5.5 Pro is restricted to medium–xhigh", () => {
    const ids = getEffortLevelsForModel("openai/gpt-5.5-pro").map((r) => r.id);

    expect(ids).toEqual(["auto", "medium", "high", "xhigh"]);
  });

  test("Claude Sonnet 5 supports adaptive effort including xhigh/max", () => {
    const ids = getEffortLevelsForModel("anthropic/claude-sonnet-5").map((r) => r.id);

    expect(ids).toContain("xhigh");
    expect(ids).toContain("max");
    expect(ids).toContain("none");
  });

  test("Gemini 3.1 Pro has no minimal level", () => {
    const ids = getEffortLevelsForModel("google/gemini-3.1-pro-preview").map((r) => r.id);

    expect(ids).toEqual(["auto", "low", "medium", "high"]);
  });

  test("Gemini 3.5 Flash includes minimal", () => {
    const ids = getEffortLevelsForModel("google/gemini-3.5-flash").map((r) => r.id);

    expect(ids).toEqual(["auto", "minimal", "low", "medium", "high"]);
  });

  test("Perplexity has no configurable effort", () => {
    expect(modelSupportsEffortControl("perplexity/sonar-pro")).toBe(false);
    expect(getEffortLevelsForModel("perplexity/sonar-pro").map((r) => r.id)).toEqual(["auto"]);
  });

  test("Auto mirrors Sonnet 5 levels", () => {
    const auto = getEffortLevelsForModel("organic-llm/auto").map((r) => r.id);
    const sonnet = getEffortLevelsForModel("anthropic/claude-sonnet-5").map((r) => r.id);

    expect(auto).toEqual(sonnet);
  });
});

describe("clampEffortForModel", () => {
  test("clamps unsupported Max to nearest for GPT-5.5", () => {
    expect(clampEffortForModel("openai/gpt-5.5", "max")).toBe("xhigh");
  });

  test("clamps minimal toward none when only none exists", () => {
    expect(clampEffortForModel("openai/gpt-5.6-terra", "minimal")).toBe("none");
  });

  test("unsupported models collapse to auto", () => {
    expect(clampEffortForModel("deepseek/deepseek-v4-pro", "high")).toBe("auto");
  });
});

describe("buildEffortProviderOptions", () => {
  test("omits options for auto", () => {
    expect(buildEffortProviderOptions("openai/gpt-5.6-sol", "auto")).toBeUndefined();
  });

  test("maps OpenAI reasoningEffort", () => {
    const opts = buildEffortProviderOptions("openai/gpt-5.6-sol", "high");

    expect(opts?.openai).toEqual({ reasoningEffort: "high" });
  });

  test("maps Anthropic adaptive + effort", () => {
    const opts = buildEffortProviderOptions("anthropic/claude-sonnet-5", "medium");

    expect(opts?.anthropic).toEqual({
      thinking: { type: "adaptive" },
      effort: "medium",
    });
  });

  test("maps Anthropic none to disabled thinking", () => {
    const opts = buildEffortProviderOptions("anthropic/claude-sonnet-5", "none");

    expect(opts?.anthropic).toEqual({ thinking: { type: "disabled" } });
  });

  test("maps Haiku to budget tokens", () => {
    const opts = buildEffortProviderOptions("anthropic/claude-haiku-4.5", "medium");

    expect(opts?.anthropic).toEqual({
      thinking: { type: "enabled", budgetTokens: 10000 },
    });
  });

  test("maps Gemini 3 thinkingLevel", () => {
    const opts = buildEffortProviderOptions("google/gemini-3.5-flash", "low");

    expect(opts?.google).toEqual({
      thinkingConfig: { thinkingLevel: "low" },
    });
  });

  test("maps Gemini 2.5 thinkingBudget", () => {
    const opts = buildEffortProviderOptions("google/gemini-2.5-flash-lite", "high");

    expect(opts?.google).toEqual({
      thinkingConfig: { thinkingBudget: 16384 },
    });
  });

  test("clamps before building OpenAI Pro options", () => {
    const opts = buildEffortProviderOptions("openai/gpt-5.5-pro", "none");

    expect(opts?.openai).toEqual({ reasoningEffort: "medium" });
  });
});
