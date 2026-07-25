import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import {
  computeContextBudget,
  computeNewThreadDefaultBudget,
  estimateTokenCountSync,
  ESTIMATED_SYSTEM_PROMPT_TOKENS,
  getModelContextWindowTokens,
} from "@/lib/chat/context-budget";

function userMessage(text: string): UIMessage {
  return {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text }],
  };
}

describe("computeContextBudget", () => {
  test("counts draft text toward next submit total", () => {
    const budget = computeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      threadMessages: [userMessage("Hello there")],
      draftText: "What is next?",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.nextSubmitTokens).toBeGreaterThan(estimateTokenCountSync("Hello there"));
    expect(budget.segments.find((s) => s.id === "draft")?.tokens).toBeGreaterThan(0);
  });

  test("adds rolling summary when thread exceeds last-N window", () => {
    const thread = Array.from({ length: 12 }, (_, i) => userMessage(`Turn ${i + 1}`));
    const budget = computeContextBudget({
      modelId: "anthropic/claude-sonnet-5",
      threadMessages: thread,
      draftText: "",
      contextMessageLimit: 10,
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.includesRollingSummary).toBe(true);
    expect(budget.packedMessageCount).toBe(10);
    expect(budget.segments.find((s) => s.id === "summary")?.tokens).toBeGreaterThan(0);
  });

  test("reserves output tokens from the model window", () => {
    const window = getModelContextWindowTokens("openai/gpt-5.6-terra");
    const budget = computeContextBudget({
      modelId: "openai/gpt-5.6-terra",
      threadMessages: [],
      draftText: "",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.inputBudgetTokens).toBeLessThan(window);
    expect(budget.reservedOutputTokens).toBeGreaterThan(0);
  });
});

describe("computeNewThreadDefaultBudget", () => {
  test("defaults to system prompt and tool overhead only", () => {
    const budget = computeNewThreadDefaultBudget({
      modelId: "openai/gpt-5.6-terra",
      memoryEnabled: false,
      webSearchEnabled: false,
      messageSearchEnabled: false,
    });

    expect(budget.source).toBe("default");
    expect(budget.packedMessageCount).toBe(0);
    expect(budget.totalThreadMessages).toBe(0);
    expect(budget.segments.find((s) => s.id === "system")?.tokens).toBe(
      ESTIMATED_SYSTEM_PROMPT_TOKENS
    );
    expect(budget.segments.find((s) => s.id === "messages")).toBeUndefined();
  });
});
