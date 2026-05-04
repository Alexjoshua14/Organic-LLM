import { beforeEach, describe, expect, test } from "bun:test";

import {
  sharedRatelimitGetRemaining as mockGetRemaining,
  sharedRatelimitLimit as mockLimit,
} from "../helpers/rate-limit-upstash";

describe("LLM rate limit (lib/rate-limit/llm)", () => {
  let llmRateLimit: typeof import("@/lib/rate-limit/llm");

  beforeEach(async () => {
    mockLimit.mockClear();
    mockGetRemaining.mockClear();
    mockLimit.mockResolvedValue({ success: true, remaining: 10 });
    llmRateLimit = await import("@/lib/rate-limit/llm");
  });

  test("checkLlmMessageLimit returns success when under limit", async () => {
    const result = await llmRateLimit.checkLlmMessageLimit("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.error).toBe(undefined);
    expect(mockLimit.mock.calls.length).toBe(1);
    expect((mockLimit.mock.calls[0] as string[])[0]).toBe("user-1");
  });

  test("checkLlmMessageLimit returns error when rate limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await llmRateLimit.checkLlmMessageLimit("user-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many LLM requests");
    expect(mockLimit.mock.calls.length).toBe(1);
  });

  test("checkRabbitHoleNodeLimit returns success when under limit", async () => {
    const result = await llmRateLimit.checkRabbitHoleNodeLimit("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.error).toBe(undefined);
    expect(mockLimit.mock.calls.length).toBe(1);
    expect((mockLimit.mock.calls[0] as string[])[0]).toBe("user-1");
  });

  test("checkRabbitHoleNodeLimit returns error when rate limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await llmRateLimit.checkRabbitHoleNodeLimit("user-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Rabbit Hole node limit exceeded");
    expect(mockLimit.mock.calls.length).toBe(1);
  });

  test("checkLlmTokenLimit returns success when token limit disabled", async () => {
    const result = await llmRateLimit.checkLlmTokenLimit("user-1", 5000);

    expect(result.success).toBe(true);
    expect(mockGetRemaining.mock.calls.length).toBe(0);
  });

  test("recordLlmTokenUsage no-ops when token limit disabled", async () => {
    await llmRateLimit.recordLlmTokenUsage("user-1", 1000);

    expect(mockLimit.mock.calls.length).toBe(0);
  });

  test("recordLlmCost no-ops when cost limit disabled", async () => {
    await llmRateLimit.recordLlmCost("user-1", "openai/gpt-5.4-mini", {
      promptTokens: 100,
      completionTokens: 50,
    });

    expect(mockLimit.mock.calls.length).toBe(0);
  });
});

describe("LLM cost (lib/rate-limit/llm-cost)", () => {
  test("computeCost returns zero for zero usage", async () => {
    const { computeCost } = await import("@/lib/rate-limit/llm-cost");
    expect(computeCost("openai/gpt-5.4-mini", {})).toBe(0);
  });

  test("computeCost returns positive units for token usage", async () => {
    const { computeCost } = await import("@/lib/rate-limit/llm-cost");
    const units = computeCost("openai/gpt-5.4-mini", {
      promptTokens: 1_000_000,
      completionTokens: 500_000,
    });
    expect(units > 0).toBe(true);
  });

  test("getModelCost returns default for unknown model", async () => {
    const { getModelCost } = await import("@/lib/rate-limit/llm-cost");
    const cost = getModelCost("unknown/model");
    expect(cost.inputPerMillion).toBe(0.25);
    expect(cost.outputPerMillion).toBe(2.0);
  });
});
