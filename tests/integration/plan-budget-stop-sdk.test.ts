import { expect, test } from "bun:test";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { tool } from "@ai-sdk/provider-utils";
import { z } from "zod";

// Imported from source: other integration files mock the "ai" module.
import { streamText } from "../../node_modules/ai/src/generate-text/stream-text";
import { isStepCount } from "../../node_modules/ai/src/generate-text/stop-condition";
import { isPlanBudgetStopError, PlanBudgetStopError } from "@/lib/plans/llm-budget-hooks";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/**
 * Pins the SDK behaviour `runLLMChatStream` relies on for a budget stop: the thrown error reaches
 * the UI stream's onError as itself, the stream ends with no finish reason, and what the model
 * already produced is still handed to onEnd for saving.
 */
test("a budget stop mid-turn ends the stream with the partial reply intact", async () => {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "Looking it up. " },
        { type: "text-end", id: "t" },
        { type: "tool-call", toolCallId: "c1", toolName: "lookup", input: "{}" },
        { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
      ]),
    }),
  });
  const stop = new PlanBudgetStopError(JSON.stringify({ code: "plan_limit", status: 429 }));
  const result = streamText({
    model,
    prompt: "Find it",
    tools: { lookup: tool({ inputSchema: z.object({}), execute: async () => "found" }) },
    stopWhen: isStepCount(5),
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === 1) throw stop;

      return {};
    },
  });
  const seen: unknown[] = [];
  let ended: { finishReason?: string; isAborted: boolean; parts: string[] } | undefined;
  const chunks: Array<{ type: string; errorText?: string }> = [];

  for await (const chunk of result.toUIMessageStream({
    onError: (error) => {
      seen.push(error);

      return error instanceof Error ? error.message : String(error);
    },
    onEnd: ({ finishReason, isAborted, messages }) => {
      ended = {
        finishReason,
        isAborted,
        parts: messages.at(-1)?.parts.map((part) => part.type) ?? [],
      };
    },
  })) {
    chunks.push(chunk as { type: string; errorText?: string });
  }

  // The SDK reports the stop first as the original error, then may re-report it as a plain
  // Error with the same message. runLLMChatStream sets its flag on the first report.
  expect(isPlanBudgetStopError(seen[0])).toBe(true);
  expect(seen.every((error) => (error as Error).message === stop.message)).toBe(true);
  expect(chunks.at(-1)).toEqual({ type: "error", errorText: stop.message });
  expect(ended?.finishReason).toBeUndefined();
  expect(ended?.isAborted).toBe(false);
  expect(ended?.parts).toEqual(["step-start", "text", "tool-lookup"]);
});
