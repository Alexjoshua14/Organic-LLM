import { describe, expect, mock, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { tool } from "@ai-sdk/provider-utils";
import { z } from "zod";

// Legacy route fixtures mock the public `ai` module globally. Exercise the real SDK here.
import { generateText } from "../../node_modules/ai/src/generate-text/generate-text";
import { streamText } from "../../node_modules/ai/src/generate-text/stream-text";
import { generateObject } from "../../node_modules/ai/src/generate-object/generate-object";
import { isStepCount } from "../../node_modules/ai/src/generate-text/stop-condition";
import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { evaluatePlanBudget } from "@/lib/plans/plan-tags";

const input = { ownerId: "trusted-owner", modelId: "openai/test", operation: "sdk-regression" };
const budget = (usedUsd: number) =>
  evaluatePlanBudget({
    plan: "free",
    source: "entitlements",
    cycle: { start: new Date("2026-10-05"), end: new Date("2026-10-12") },
    usedUsd,
    resetsRemaining: 5,
  });
const usage = {
  inputTokens: { total: 120, noCache: 20, cacheRead: 100, cacheWrite: 0 },
  outputTokens: { total: 30, text: 20, reasoning: 10 },
};
const result = {
  content: [{ type: "tool-call" as const, toolCallId: "call-1", toolName: "lookup", input: "{}" }],
  finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
  usage,
  providerMetadata: { gateway: { cost: "0.25" } },
  warnings: [],
};

describe("actual SDK budget enforcement", () => {
  test("stream delivery reports the allowance error and makes no second provider call", async () => {
    let spent = 9.75;
    const record = mock(async () => {
      spent = 10;
    });
    const model = new MockLanguageModelV4({
      doStream: {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({
              type: "tool-call",
              toolCallId: "call-1",
              toolName: "lookup",
              input: "{}",
            });
            controller.enqueue({
              type: "finish",
              finishReason: result.finishReason,
              usage,
              providerMetadata: result.providerMetadata,
            });
            controller.close();
          },
        }),
      },
    });
    const response = streamText({
      model,
      prompt: "Look up",
      maxRetries: 0,
      ...createLlmBudgetHooks(input, { read: async () => budget(spent), record }),
      tools: {
        lookup: tool({ inputSchema: z.object({}), execute: async () => ({ found: true }) }),
      },
      stopWhen: isStepCount(3),
    });
    const errors: unknown[] = [];
    for await (const part of response.fullStream)
      if (part.type === "error") errors.push(part.error);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(record).toHaveBeenCalledTimes(1);
    expect(errors.map(String).join(" ")).toContain("plan_limit");
  });
  test("awaits a paid tool step's ledger write before deciding whether another call may start", async () => {
    let spent = 9.75;
    const record = mock(async () => {
      await Promise.resolve();
      spent = 10;
    });
    const model = new MockLanguageModelV4({ doGenerate: result });
    const lookup = mock(async () => ({ found: true }));
    const hooks = createLlmBudgetHooks(input, { read: async () => budget(spent), record });
    await expect(
      generateText({
        model,
        prompt: "Look it up",
        ...hooks,
        maxRetries: 0,
        tools: { lookup: tool({ inputSchema: z.object({}), execute: lookup }) },
        stopWhen: isStepCount(3),
      })
    ).rejects.toThrow("plan_limit");
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      ...input,
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        totalTokens: 150,
        inputTokenDetails: { cacheReadTokens: 100 },
        outputTokenDetails: { reasoningTokens: 10 },
      },
      providerMetadata: { gateway: { cost: "0.25" } },
    });
  });
  test("an exhausted budget makes zero provider calls", async () => {
    const model = new MockLanguageModelV4({ doGenerate: result });
    const record = mock(async () => {});
    await expect(
      generateText({
        model,
        prompt: "Blocked",
        maxRetries: 0,
        ...createLlmBudgetHooks(input, { read: async () => budget(10), record }),
      })
    ).rejects.toThrow("plan_limit");
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(record).not.toHaveBeenCalled();
  });
  test("a failed ledger write stops the tool loop explicitly", async () => {
    const model = new MockLanguageModelV4({ doGenerate: result });
    await expect(
      generateText({
        model,
        prompt: "Look up",
        maxRetries: 0,
        ...createLlmBudgetHooks(input, {
          read: async () => budget(0),
          record: async () => {
            throw new Error("Ledger unavailable");
          },
        }),
        tools: { lookup: tool({ inputSchema: z.object({}), execute: async () => "result" }) },
        stopWhen: isStepCount(3),
      })
    ).rejects.toThrow("Usage ledger unavailable");
    expect(model.doGenerateCalls).toHaveLength(1);
  });
  test("structured generation invokes the awaited ledger callback even when JSON is invalid", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        ...result,
        content: [{ type: "text", text: "invalid JSON" }],
        finishReason: { unified: "stop", raw: "stop" },
      },
    });
    const record = mock(async () => {});
    const hooks = createLlmBudgetHooks(input, { read: async () => budget(0), record });
    await hooks.prepareStep();
    await expect(
      generateObject({
        model,
        prompt: "Return JSON",
        schema: z.object({ value: z.string() }),
        maxRetries: 0,
        ...hooks,
      })
    ).rejects.toThrow();
    expect(record).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
