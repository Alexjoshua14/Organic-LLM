import { expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { tool } from "@ai-sdk/provider-utils";
import { z } from "zod";

import { generateText } from "../../node_modules/ai/src/generate-text/generate-text";
import { isStepCount } from "../../node_modules/ai/src/generate-text/stop-condition";
import { prepareChatCompletionStep } from "@/lib/api/chat-step-completion";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

test("actual SDK gives the final step tool results but no callable tools", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      {
        content: [{ type: "tool-call", toolCallId: "lookup-1", toolName: "lookup", input: "{}" }],
        finishReason: { unified: "tool-calls", raw: "tool_calls" },
        usage,
        warnings: [],
      },
      {
        content: [{ type: "text", text: "Here is the result." }],
        finishReason: { unified: "stop", raw: "stop" },
        usage,
        warnings: [],
      },
    ],
  });
  const result = await generateText({
    model,
    instructions: "Keep original instructions.",
    prompt: "Find the answer",
    tools: {
      lookup: tool({ inputSchema: z.object({}), execute: async () => "confirmed evidence" }),
    },
    stopWhen: isStepCount(2),
    prepareStep: ({ stepNumber }) =>
      prepareChatCompletionStep({
        stepNumber,
        maxSteps: 2,
        hasTools: true,
        instructions: "Keep original instructions.",
      }),
  });

  expect(result.text).toBe("Here is the result.");
  expect(model.doGenerateCalls).toHaveLength(2);
  expect(model.doGenerateCalls[0].tools).toHaveLength(1);
  expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("two model steps remaining");
  const finalCall = model.doGenerateCalls[1];
  expect(finalCall.tools ?? []).toHaveLength(0);
  expect(finalCall.toolChoice).toEqual({ type: "none" });
  const prompt = JSON.stringify(finalCall.prompt);
  expect(prompt).toContain("Keep original instructions.");
  expect(prompt).toContain("confirmed evidence");
  expect(prompt).toContain("final response step");
  expect(prompt).not.toContain("two model steps remaining");
});
