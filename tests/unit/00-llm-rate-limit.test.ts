import { beforeEach, describe, expect, spyOn, test } from "bun:test";

import { Logger } from "@/lib/logger";

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

  test("message quota denial preserves the provider reset timestamp", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: 1_900_000_000_000 });

    expect((await llmRateLimit.checkLlmMessageLimit("user-1")).reset).toBe(1_900_000_000_000);
  });

  test("an Upstash timeout admission still admits, and is reported", async () => {
    const warn = spyOn(Logger.prototype, "warn").mockImplementation(() => {});

    // The shape @upstash/ratelimit 2.x returns when its timeout fires before Redis answers.
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      pending: Promise.resolve(),
      reason: "timeout",
    });

    try {
      const result = await llmRateLimit.checkLlmMessageLimit("user-1");

      expect(result.success).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[2]).toMatchObject({
        metric: "rate_limit.timeout_admitted",
        limiter: "checkLlmMessageLimit",
      });
      // No user data in the metric.
      expect(JSON.stringify(warn.mock.calls[0]?.[2])).not.toContain("user-1");
    } finally {
      warn.mockRestore();
    }
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

  test("cache discounts work for SDK 7 usage and flat ledger usage", async () => {
    const { computeUsageCostUsd } = await import("@/lib/rate-limit/llm-cost");
    const base = { inputTokens: 1_000_000, outputTokens: 0 };
    const flat = computeUsageCostUsd("openai/gpt-6-sol", { ...base, cachedInputTokens: 500_000 });
    const sdk = computeUsageCostUsd("openai/gpt-6-sol", {
      ...base,
      inputTokenDetails: { cacheReadTokens: 500_000 },
    });

    expect(flat).toBeCloseTo(1.1);
    expect(sdk).toBeCloseTo(flat);
  });
});
