import { describe, expect, test } from "bun:test";

import {
  maxInputTokensForBudget,
  maxOutputTokensForBudget,
  packMessagesForInputBudget,
} from "@/lib/jev-stage/budget";
import {
  JEV_STAGE_RESPOND_INPUT_BUDGET_USD,
  JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD,
} from "@/lib/jev-stage/constants";
import { getModelCost } from "@/lib/rate-limit/llm-cost";

describe("jev-stage budget", () => {
  test("input token cap expands for cheaper models", () => {
    const astra = maxInputTokensForBudget("openai/gpt-6.2-astra");
    const sol = maxInputTokensForBudget("openai/gpt-6.2-sol");

    expect(sol).toBeGreaterThan(astra);
    expect(astra).toBe(
      Math.floor(
        (JEV_STAGE_RESPOND_INPUT_BUDGET_USD / getModelCost("openai/gpt-6.2-astra").inputPerMillion) *
          1_000_000
      )
    );
  });

  test("output token cap is clamped by the hard max", () => {
    const tokens = maxOutputTokensForBudget("openai/gpt-6.2-sol");
    const rate = getModelCost("openai/gpt-6.2-sol").outputPerMillion;
    const uncapped = Math.floor((JEV_STAGE_RESPOND_OUTPUT_BUDGET_USD / rate) * 1_000_000);

    expect(uncapped).toBeGreaterThan(tokens);
    expect(tokens).toBe(8000);
  });

  test("packs newest messages first within the budget", () => {
    const messages = Array.from({ length: 80 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      text: `message ${i} ${"x".repeat(4000)}`,
    }));
    const packed = packMessagesForInputBudget(messages, "openai/gpt-6.2-astra");

    expect(packed.truncated).toBe(true);
    expect(packed.messages.length).toBeGreaterThan(0);
    expect(packed.messages.length).toBeLessThan(messages.length);
    expect(packed.messages.at(-1)?.text).toContain("message 79");
  });
});
