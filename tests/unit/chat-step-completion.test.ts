import { describe, expect, test } from "bun:test";

import { prepareChatCompletionStep } from "@/lib/api/chat-step-completion";

const base = { maxSteps: 16, hasTools: true, instructions: "Original instructions" };

describe("chat completion steps", () => {
  test("ordinary steps and tool-free turns remain unchanged", () => {
    expect(prepareChatCompletionStep({ ...base, stepNumber: 13 })).toEqual({});
    expect(prepareChatCompletionStep({ ...base, stepNumber: 15, hasTools: false })).toEqual({});
  });

  test("penultimate step warns without disabling tools", () => {
    const result = prepareChatCompletionStep({ ...base, stepNumber: 14 });
    expect(result?.instructions).toContain("Original instructions");
    expect(result?.instructions).toContain("at most one more tool call");
    expect(result?.activeTools).toBeUndefined();
    expect(result?.toolChoice).toBeUndefined();
  });

  test.each([1, 2, 8, 16])("last of %i steps is reserved for a final reply", (maxSteps) => {
    const result = prepareChatCompletionStep({ ...base, maxSteps, stepNumber: maxSteps - 1 });
    expect(result?.activeTools).toEqual([]);
    expect(result?.toolChoice).toBe("none");
    expect(result?.instructions).toContain("Original instructions");
    expect(result?.instructions).toContain("unfinished work");
    expect(result?.instructions).not.toContain("two model steps remaining");
  });
});
