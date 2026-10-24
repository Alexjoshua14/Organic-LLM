import { describe, expect, test } from "bun:test";

import {
  buildChatReasoningProviderOptions,
  buildEffortProviderOptions,
  clampEffortForModel,
  getEffortLevelsForModel,
  modelSupportsEffortControl,
} from "@/lib/schemas/chat-effort";
import { AUTO_CHAT_MODEL_ID } from "@/lib/schemas/chat-model-ids";

describe("getEffortLevelsForModel", () => {
  test("GPT-5.6 exposes none through max (no minimal)", () => {
    const ids = getEffortLevelsForModel("openai/gpt-5.6-sol").map((r) => r.id);

    expect(ids).toEqual(["auto", "none", "low", "medium", "high", "xhigh", "max"]);
  });

  test("GPT-6 Sol has no none or minimal", () => {
    const ids = getEffortLevelsForModel("openai/gpt-6-sol").map((r) => r.id);

    expect(ids).toEqual(["auto", "low", "medium", "high", "xhigh", "max"]);
  });

  test("GPT-6 Astra has no none or minimal", () => {
    const ids = getEffortLevelsForModel("openai/gpt-6-astra").map((r) => r.id);

    expect(ids).toEqual(["auto", "low", "medium", "high", "xhigh", "max"]);
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

  test("Gemini 3.8 Flash has no minimal", () => {
    const ids = getEffortLevelsForModel("google/gemini-3.8-flash").map((r) => r.id);

    expect(ids).toEqual(["auto", "low", "medium", "high"]);
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

  test("clamps none to low when GPT-6 Sol has no none", () => {
    expect(clampEffortForModel("openai/gpt-6-sol", "none")).toBe("low");
  });

  test("clamps none to low when GPT-6 Astra has no none", () => {
    expect(clampEffortForModel("openai/gpt-6-astra", "none")).toBe("low");
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

  test("maps Opus 5.5 none to adaptive low (thinking always on)", () => {
    const opts = buildEffortProviderOptions("anthropic/claude-opus-5.5", "none");

    expect(opts?.anthropic).toEqual({
      thinking: { type: "adaptive" },
      effort: "low",
    });
  });

  test("maps Sonnet 5.5 none to between_tools (disabled is rejected)", () => {
    const opts = buildEffortProviderOptions("anthropic/claude-sonnet-5.5", "none");

    expect(opts?.anthropic).toEqual({ thinking: { type: "between_tools" } });
  });

  test("maps Auto none through Sonnet 5.5 to between_tools", () => {
    const opts = buildEffortProviderOptions(AUTO_CHAT_MODEL_ID, "none");

    expect(opts?.anthropic).toEqual({ thinking: { type: "between_tools" } });
  });

  test("maps Haiku 5.5 to adaptive + effort, not budget tokens", () => {
    expect(getEffortLevelsForModel("anthropic/claude-haiku-5.5").map((r) => r.id)).toEqual([
      "auto",
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(buildEffortProviderOptions("anthropic/claude-haiku-5.5", "medium")?.anthropic).toEqual({
      thinking: { type: "adaptive" },
      effort: "medium",
    });
    expect(buildEffortProviderOptions("anthropic/claude-haiku-5.5", "none")?.anthropic).toEqual({
      thinking: { type: "disabled" },
    });
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

  test("maps Gemini 3.8 Flash none to low thinking", () => {
    const opts = buildEffortProviderOptions("google/gemini-3.8-flash", "none");

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

describe("buildChatReasoningProviderOptions", () => {
  test("requests OpenAI reasoning summaries alongside effort", () => {
    expect(buildChatReasoningProviderOptions("openai/gpt-5.6-sol", "auto").openai).toEqual({
      reasoningSummary: "auto",
    });
    expect(buildChatReasoningProviderOptions("openai/gpt-5.6-sol", "high").openai).toEqual({
      reasoningEffort: "high",
      reasoningSummary: "auto",
    });
  });

  test("skips OpenAI summaries when reasoning is off", () => {
    expect(buildChatReasoningProviderOptions("openai/gpt-5.6-sol", "none").openai).toEqual({
      reasoningEffort: "none",
    });
  });

  test("leaves non-reasoning OpenAI models untouched", () => {
    expect(buildChatReasoningProviderOptions("openai/gpt-4o-mini", "auto").openai).toBeUndefined();
  });

  test("skips Gemini thoughts when thinking is budgeted off", () => {
    expect(
      buildChatReasoningProviderOptions("google/gemini-2.5-flash-lite", "none").google
    ).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
  });

  test("merges Gemini includeThoughts into thinkingConfig", () => {
    expect(buildChatReasoningProviderOptions("google/gemini-3.5-flash", "low").google).toEqual({
      thinkingConfig: { thinkingLevel: "low", includeThoughts: true },
    });
    expect(buildChatReasoningProviderOptions("google/gemini-3.5-flash", "auto").google).toEqual({
      thinkingConfig: { includeThoughts: true },
    });
  });

  test("asks adaptive Claude thinking for summarized display", () => {
    expect(
      buildChatReasoningProviderOptions("anthropic/claude-sonnet-5", "medium").anthropic
    ).toEqual({
      thinking: { type: "adaptive", display: "summarized" },
      effort: "medium",
    });
  });

  test("sets summarized display on auto for Claude models that think by default", () => {
    expect(
      buildChatReasoningProviderOptions("anthropic/claude-opus-5.5", "auto").anthropic
    ).toEqual({
      thinking: { type: "adaptive", display: "summarized" },
    });
  });

  test("leaves Sonnet 5.5 between_tools without display (display alongside is a 400)", () => {
    expect(
      buildChatReasoningProviderOptions("anthropic/claude-sonnet-5.5", "none").anthropic
    ).toEqual({ thinking: { type: "between_tools" } });
  });

  test("never turns Claude thinking on where it is off", () => {
    expect(
      buildChatReasoningProviderOptions("anthropic/claude-opus-4.8", "auto").anthropic
    ).toBeUndefined();
    expect(
      buildChatReasoningProviderOptions("anthropic/claude-sonnet-5", "none").anthropic
    ).toEqual({
      thinking: { type: "disabled" },
    });
  });
});
