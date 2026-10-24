import { describe, expect, test } from "bun:test";
import type { LanguageModelUsage } from "ai";

import { summarizeContextBudgetUsage } from "@/lib/chat/context-budget-usage";

function usage(input: number, cached: number | undefined, output: number): LanguageModelUsage {
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: cached,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: { textTokens: output, reasoningTokens: undefined },
  };
}

describe("last-send provider usage", () => {
  test("totals input, cached input, output and actual billed cost across tool steps", () => {
    expect(
      summarizeContextBudgetUsage(
        "openai/gpt-6-sol",
        [
          { usage: usage(100, 60, 10), providerMetadata: { gateway: { cost: "0.001" } } },
          { usage: usage(150, 100, 30), providerMetadata: { gateway: { cost: 0.002 } } },
        ],
        true
      )
    ).toEqual({
      inputTokens: 250,
      cachedInputTokens: 160,
      outputTokens: 40,
      costUsd: 0.003,
      costSource: "gateway",
      modelCalls: 2,
      complete: true,
    });
  });

  test("doesn't turn unreported cached tokens into zero or invent partial totals", () => {
    const result = summarizeContextBudgetUsage("openai/gpt-6-sol", [
      { usage: usage(100, 60, 10) },
      { usage: usage(150, undefined, 30) },
    ]);

    expect(result.inputTokens).toBe(250);
    expect(result.cachedInputTokens).toBeUndefined();
    expect(result.costUsd).toBeUndefined();
    expect(result.complete).toBe(false);
  });

  test("marks price-table cost as estimated and preserves reported zero cache/cost", () => {
    const estimated = summarizeContextBudgetUsage("openai/gpt-6-sol", [
      { usage: usage(100, 0, 10) },
    ]);

    expect(estimated.costSource).toBe("estimate");
    expect(estimated.costUsd).toBeGreaterThan(0);
    expect(
      summarizeContextBudgetUsage("openai/gpt-6-sol", [
        { usage: usage(0, 0, 0), providerMetadata: { gateway: { cost: 0 } } },
      ]).costUsd
    ).toBe(0);
    expect(summarizeContextBudgetUsage("openai/gpt-6-sol", []).inputTokens).toBeUndefined();
  });
});
