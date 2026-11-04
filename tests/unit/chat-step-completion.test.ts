import type { ModelMessage } from "ai";

import { describe, expect, test } from "bun:test";

import {
  FINAL_STEP_NOTICE,
  PENULTIMATE_STEP_NOTICE,
  prepareChatCompletionStep,
} from "@/lib/api/chat-step-completion";

const messages: ModelMessage[] = [
  { role: "user", content: "Find the answer" },
  {
    role: "assistant",
    content: [{ type: "tool-call", toolCallId: "t1", toolName: "lookup", input: {} }],
  },
];
const base = { maxSteps: 16, hasTools: true, messages };

function lastText(result: ReturnType<typeof prepareChatCompletionStep>): string {
  const last = result?.messages?.at(-1);

  expect(last?.role).toBe("user");
  return JSON.stringify(last?.content);
}

describe("chat completion steps", () => {
  test("ordinary steps and tool-free turns remain unchanged", () => {
    expect(prepareChatCompletionStep({ ...base, stepNumber: 13 })).toEqual({});
    expect(prepareChatCompletionStep({ ...base, stepNumber: 15, hasTools: false })).toEqual({});
  });

  test("penultimate step appends a notice without touching instructions or tools", () => {
    const result = prepareChatCompletionStep({ ...base, stepNumber: 14 });

    expect(result?.messages?.slice(0, messages.length)).toEqual(messages);
    expect(result?.messages).toHaveLength(messages.length + 1);
    expect(lastText(result)).toContain(PENULTIMATE_STEP_NOTICE);
    expect(result?.instructions).toBeUndefined();
    expect(result?.activeTools).toBeUndefined();
    expect(result?.toolChoice).toBeUndefined();
  });

  test.each([1, 2, 8, 16])("last of %i steps is reserved for a final reply", (maxSteps) => {
    const result = prepareChatCompletionStep({ ...base, maxSteps, stepNumber: maxSteps - 1 });

    expect(result?.toolChoice).toBe("none");
    // Tool definitions and instructions stay as they were, so the cache prefix survives.
    expect(result?.activeTools).toBeUndefined();
    expect(result?.instructions).toBeUndefined();
    expect(result?.messages?.slice(0, messages.length)).toEqual(messages);
    expect(lastText(result)).toContain(FINAL_STEP_NOTICE);
    expect(lastText(result)).not.toContain(PENULTIMATE_STEP_NOTICE);
  });

  test("does not mutate the step's input messages", () => {
    const input = [...messages];

    prepareChatCompletionStep({ ...base, messages: input, stepNumber: 15 });
    expect(input).toEqual(messages);
  });
});
