import { expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { tool } from "@ai-sdk/provider-utils";
import { z } from "zod";

// Imported from source: other integration files mock the "ai" module.
import { generateText } from "../../node_modules/ai/src/generate-text/generate-text";
import { isStepCount } from "../../node_modules/ai/src/generate-text/stop-condition";
import {
  FINAL_STEP_NOTICE,
  PENULTIMATE_STEP_NOTICE,
  prepareChatCompletionStep,
} from "@/lib/api/chat-step-completion";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const toolCallStep = (id: string) => ({
  content: [{ type: "tool-call" as const, toolCallId: id, toolName: "lookup", input: "{}" }],
  finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
  usage,
  warnings: [],
});

test("actual SDK keeps the prompt prefix stable while reserving the final step", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      toolCallStep("lookup-1"),
      toolCallStep("lookup-2"),
      {
        content: [{ type: "text", text: "Here is the result." }],
        finishReason: { unified: "stop", raw: "stop" },
        usage,
        warnings: [],
      },
    ],
  });
  const maxSteps = 3;
  const result = await generateText({
    model,
    instructions: "Keep original instructions.",
    prompt: "Find the answer",
    tools: {
      lookup: tool({ inputSchema: z.object({}), execute: async () => "confirmed evidence" }),
    },
    stopWhen: isStepCount(maxSteps),
    prepareStep: ({ stepNumber, messages }) =>
      prepareChatCompletionStep({ stepNumber, maxSteps, hasTools: true, messages }),
  });

  expect(result.text).toBe("Here is the result.");
  const calls = model.doGenerateCalls;

  expect(calls).toHaveLength(3);

  // Cache prefix: every call's prompt starts with the previous call's prompt, unchanged.
  for (let i = 1; i < calls.length; i++) {
    expect(calls[i].prompt.slice(0, calls[i - 1].prompt.length)).toEqual(calls[i - 1].prompt);
  }
  // Tool definitions are sent on every step, including the final one.
  for (const call of calls) expect(call.tools).toHaveLength(1);

  expect(JSON.stringify(calls[0].prompt)).not.toContain("runtime_notice");
  expect(JSON.stringify(calls[1].prompt.at(-1))).toContain(PENULTIMATE_STEP_NOTICE);

  const finalCall = calls[2];

  expect(finalCall.toolChoice).toEqual({ type: "none" });
  expect(JSON.stringify(finalCall.prompt.at(-1))).toContain(FINAL_STEP_NOTICE);
  expect(JSON.stringify(finalCall.prompt)).toContain("confirmed evidence");
  expect(JSON.stringify(finalCall.prompt[0])).toContain("Keep original instructions.");

  // Notices are step input only; they never become response messages that get saved.
  expect(JSON.stringify(result.response.messages)).not.toContain("runtime_notice");
});
