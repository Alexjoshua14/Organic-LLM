import { expect, test } from "bun:test";
import { experimental_createSteering, stepCountIs, streamText } from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";

import { mergeJevStageTurn } from "@/lib/jev-stage/merge-turn";
import { cacheByProvider, replyAfterLastCorrection } from "@/lib/jev-stage/trace";
import { emptyStageState } from "@/lib/stage/schema";

const usage = {
  inputTokens: { total: 20, noCache: 12, cacheRead: 8, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function modelWithCompletedSteps() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: "text-start", id: "text" },
        { type: "text-delta", id: "text", delta: "Draft" },
        { type: "text-end", id: "text" },
        { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
      ]),
    }),
  });
}

test("SDK steering extends a completed step and leaves its prompt prefix intact", async () => {
  const sdk = experimental_createSteering();
  const model = modelWithCompletedSteps();
  let delivery: ReturnType<typeof sdk.steer> | undefined;
  const result = streamText({
    model,
    instructions: "Stable instructions",
    prompt: "Original request",
    experimental_steering: sdk,
    stopWhen: stepCountIs(2),
    onStepEnd: ({ stepNumber }) => {
      if (stepNumber === 0) delivery = sdk.steer("Change the example to Python");
    },
  });

  await result.consumeStream();
  expect(await delivery).toMatchObject({ type: "delivered", stepNumber: 1 });
  expect(model.doStreamCalls).toHaveLength(2);
  const [first, second] = model.doStreamCalls;

  expect(second!.prompt.slice(0, first!.prompt.length)).toEqual(first!.prompt);
  expect(JSON.stringify(second!.prompt.at(-1))).toContain("Change the example to Python");
  expect((await result.totalUsage).inputTokenDetails.cacheReadTokens).toBe(16);
  expect(replyAfterLastCorrection("DraftDraft", await result.steps)).toBe("Draft");
});

test("SDK steering is undelivered when the existing stop condition wins", async () => {
  const sdk = experimental_createSteering();
  let delivery: ReturnType<typeof sdk.steer> | undefined;
  const result = streamText({
    model: modelWithCompletedSteps(),
    prompt: "Original request",
    experimental_steering: sdk,
    stopWhen: stepCountIs(1),
    onStepEnd: () => {
      delivery = sdk.steer("A correction at the last boundary");
    },
  });

  await result.consumeStream();
  expect(await delivery).toMatchObject({ type: "not-delivered", reason: "stop-condition" });
});

test("a slow turn keeps a newer stage change, both conversation lines and the current designer", () => {
  const base = emptyStageState();
  const lateMessage = { id: crypto.randomUUID(), role: "assistant" as const, text: "Late reply" };
  const firstMessage = { id: crypto.randomUUID(), role: "assistant" as const, text: "First reply" };
  const stageAt = new Date().toISOString();
  const firstJob = { id: crypto.randomUUID(), brief: "First design" };
  const lateJob = { id: crypto.randomUUID(), brief: "Late design" };
  const current = {
    ...base,
    revision: 3,
    summary: "Current context",
    messages: [firstMessage],
    design: {
      ...firstJob,
      status: "working" as const,
      phase: "queued" as const,
      startedAt: stageAt,
    },
  };
  const result = {
    ...base,
    summary: "Stale context",
    messages: [lateMessage],
    design: { ...current.design, ...lateJob },
  };

  const merged = mergeJevStageTurn(base, result, current);
  expect(merged.conflict).toBe(true);
  expect(merged.state).toMatchObject({
    revision: 4,
    summary: "Current context",
    messages: [firstMessage, lateMessage],
    design: current.design,
    pendingDesigns: [lateJob],
  });
});

test("cache totals preserve attribution and distinguish a reported zero", () => {
  const step = (provider: string, cacheReadTokens?: number) => ({
    response: { modelId: "actual-model" },
    providerMetadata: { gateway: { routing: { finalProvider: provider } } },
    usage: { inputTokenDetails: { cacheReadTokens } },
  });

  expect(
    cacheByProvider("requested-model", [
      step("bedrock", 10),
      step("bedrock", 20),
      step("anthropic", 0),
      step("anthropic"),
    ])
  ).toEqual([
    { provider: "bedrock", model: "actual-model", cachedInputTokens: 30 },
    { provider: "anthropic", model: "actual-model", cachedInputTokens: 0 },
    { provider: "anthropic", model: "actual-model", cachedInputTokens: null },
  ]);
});
