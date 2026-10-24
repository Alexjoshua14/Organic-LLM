import { describe, expect, test } from "bun:test";

import type { UIMessage } from "ai";

import {
  ARCADIA_MESSAGE_TOKEN_BUDGET,
  ARCADIA_MIN_RECENT_MESSAGES,
  HARD_MAX_LLM_INPUT_TOKENS,
  selectArcadiaContextMessages,
  sumMessagesTokens,
} from "@/lib/chat/arcadia-token-context";
import {
  assertLlmInputWithinHardCap,
  estimateLlmInputTokens,
} from "@/lib/api/llm-input-token-guard";

function userMessage(id: string, text: string, pinned = false): UIMessage {
  return {
    id,
    role: "user",
    metadata: pinned ? { pinned: true } : undefined,
    parts: [{ type: "text", text }],
  };
}

describe("selectArcadiaContextMessages", () => {
  test("keeps all messages when under token budget", () => {
    const messages = [
      userMessage("1", "Hello"),
      userMessage("2", "How are you?"),
      userMessage("3", "Still here"),
    ];

    const selection = selectArcadiaContextMessages(messages, {
      tokenBudget: ARCADIA_MESSAGE_TOKEN_BUDGET,
    });

    expect(selection.needsCondensation).toBe(false);
    expect(selection.contextMessages).toHaveLength(3);
    expect(selection.messagesToCondense).toHaveLength(0);
    expect(selection.recentCount).toBe(3);
  });

  test("flags condensation when history exceeds budget", () => {
    const longText = "word ".repeat(8_000);
    const messages = Array.from({ length: 12 }, (_, index) =>
      userMessage(String(index + 1), `${longText} ${index + 1}`)
    );

    const selection = selectArcadiaContextMessages(messages, {
      tokenBudget: 2_000,
      minRecentCount: ARCADIA_MIN_RECENT_MESSAGES,
    });

    expect(sumMessagesTokens(messages)).toBeGreaterThan(2_000);
    expect(selection.needsCondensation).toBe(true);
    expect(selection.recentCount).toBeGreaterThanOrEqual(ARCADIA_MIN_RECENT_MESSAGES);
    expect(selection.messagesToCondense.length).toBeGreaterThan(0);
    // Min-recent guarantee can exceed the budget; condensation still folds older turns.
    expect(selection.contextMessageTokens).toBeGreaterThan(2_000);
  });

  test("caps pinned messages at 20% of budget", () => {
    const pinnedLarge = userMessage("pin-1", "pinned ".repeat(3_000), true);
    const pinnedSmall = userMessage("pin-2", "small pin", true);
    const recent = Array.from({ length: 6 }, (_, index) =>
      userMessage(`recent-${index}`, `recent ${index}`)
    );

    const selection = selectArcadiaContextMessages([pinnedLarge, pinnedSmall, ...recent], {
      tokenBudget: 1_000,
      pinnedBudgetRatio: 0.2,
      minRecentCount: 2,
    });

    expect(selection.pinnedCount).toBeLessThanOrEqual(1);
    expect(selection.pinnedTokens).toBeLessThanOrEqual(200);
    expect(selection.recentCount).toBeGreaterThanOrEqual(2);
  });
});

describe("llm input hard cap", () => {
  test("throws when assembled input exceeds 300k tokens", () => {
    const huge = "token ".repeat(120_000);
    const estimate = estimateLlmInputTokens({
      systemPrompt: huge,
      toolInstructions: huge,
      messages: [userMessage("1", huge)],
    });

    expect(estimate.totalTokens).toBeGreaterThan(HARD_MAX_LLM_INPUT_TOKENS);
    expect(() => assertLlmInputWithinHardCap(estimate)).toThrow(/hard cap/i);
  });

  test("allows typical assembled turns under the cap", () => {
    const estimate = estimateLlmInputTokens({
      systemPrompt: "You are Organic LLM.",
      toolInstructions: "Use tools when helpful.",
      messages: [userMessage("1", "Hello there")],
    });

    expect(() => assertLlmInputWithinHardCap(estimate)).not.toThrow();
  });
});
