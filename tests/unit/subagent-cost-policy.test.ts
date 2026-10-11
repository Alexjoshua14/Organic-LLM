import type { ModelMessage } from "ai";

import { describe, expect, test } from "bun:test";

import { selectSubagentModel } from "@/lib/llm/subagents/orchestrator/cost-policy";
import { prepareSubagentStep, subagentRunLimits } from "@/lib/llm/subagents/worker/cost-limits";
import { models } from "@/lib/schemas/chat-models";

const step = {
  stepNumber: 0,
  steps: [] as Array<{ usage: { outputTokens?: number } }>,
  messages: [
    { role: "user", content: "Read the evidence and compare the options." },
  ] as ModelMessage[],
  instructions: "Research the assigned question using primary sources.",
  toolSchemaText: "[]",
  research: true,
};

describe("subagent model selection", () => {
  test("defaults to economy independently of the orchestrator's model", () => {
    expect(selectSubagentModel({ zeroDataRetention: true })).toEqual({
      ok: true,
      modelId: models.anthropic.haiku.id,
      tier: "economy",
    });
  });

  test("standard is bounded to the configured model and needs a meaningful reason", () => {
    expect(
      selectSubagentModel({ tier: "standard", reason: "architect", zeroDataRetention: true }).ok
    ).toBe(false);
    expect(
      selectSubagentModel({
        tier: "standard",
        reason: "Resolve concurrency and recovery invariants in the implementation.",
        zeroDataRetention: true,
      })
    ).toEqual({ ok: true, modelId: models.anthropic.sonnet.id, tier: "standard" });
  });
});

describe("bounded worker steps", () => {
  test("ordinary workers and research workers have smaller distinct loop allowances", () => {
    expect(subagentRunLimits(false).maxSteps).toBe(8);
    expect(subagentRunLimits(true).maxSteps).toBe(12);
    expect(prepareSubagentStep(step).maxOutputTokens).toBe(4_000);
  });

  test("total output reduces the next call's cap and forces a usable final response", () => {
    const next = prepareSubagentStep({
      ...step,
      stepNumber: 4,
      steps: [{ usage: { outputTokens: 15_100 } }],
    });

    expect(next.maxOutputTokens).toBe(900);
    expect(next.toolChoice).toBe("none");
    expect(next.instructions).toContain("unfinished work");
  });

  test("the last allowed step wraps up without starting another tool cycle", () => {
    expect(prepareSubagentStep({ ...step, stepNumber: 11 }).toolChoice).toBe("none");
    expect(prepareSubagentStep({ ...step, research: false, stepNumber: 7 }).toolChoice).toBe(
      "none"
    );
    expect(() => prepareSubagentStep({ ...step, stepNumber: 12 })).toThrow("allowance exhausted");
  });

  test("exhausted or missing usage cannot start unbounded extra calls", () => {
    expect(() =>
      prepareSubagentStep({ ...step, steps: [{ usage: { outputTokens: 16_000 } }] })
    ).toThrow("allowance exhausted");
    expect(() =>
      prepareSubagentStep({
        ...step,
        stepNumber: 4,
        steps: Array.from({ length: 4 }, () => ({ usage: {} })),
      })
    ).toThrow("allowance exhausted");
  });

  test("large tool results and tool definitions are counted before another model call", () => {
    const large = "a distinct piece of captured evidence. ".repeat(10_000);

    expect(() =>
      prepareSubagentStep({ ...step, messages: [{ role: "user", content: large }] })
    ).toThrow("input exceeds its cost limit");
    expect(() => prepareSubagentStep({ ...step, toolSchemaText: large })).toThrow(
      "input exceeds its cost limit"
    );
  });
});
