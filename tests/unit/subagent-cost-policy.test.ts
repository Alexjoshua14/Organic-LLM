import type { ModelMessage } from "ai";

import { describe, expect, test } from "bun:test";

import { estimateTokenCountSync } from "@/lib/chat/context-budget";
import { selectSubagentModel } from "@/lib/llm/subagents/orchestrator/cost-policy";
import {
  SUBAGENT_MAX_INPUT_TOKENS,
  SUBAGENT_MAX_RUN_COST_USD,
  prepareSubagentStep,
  subagentRunLimits,
} from "@/lib/llm/subagents/worker/cost-limits";
import { getModelCost } from "@/lib/rate-limit/llm-cost";
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
    expect(subagentRunLimits(true).maxInputTokens).toBe(24_000);
    expect(subagentRunLimits(true).maxRunCostUsd).toBe(0.25);
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

  test("later steps compact oversized tool results and finish instead of raising the 24k limit", () => {
    const evidence = "captured evidence from a primary source. ".repeat(12_000);
    const messages = [
      { role: "user" as const, content: "Compare the lease options and cite the sources." },
      {
        role: "assistant" as const,
        content: [
          {
            type: "tool-call" as const,
            toolCallId: "call-old",
            toolName: "research_read",
            input: { url: "https://example.test/old" },
          },
        ],
      },
      {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "call-old",
            toolName: "research_read",
            output: { type: "text" as const, value: evidence },
          },
        ],
      },
      {
        role: "assistant" as const,
        content: [
          {
            type: "tool-call" as const,
            toolCallId: "call-new",
            toolName: "research_read",
            input: { url: "https://example.test/new" },
          },
        ],
      },
      {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: "call-new",
            toolName: "research_read",
            output: { type: "json" as const, value: { body: evidence } },
          },
        ],
      },
    ] satisfies ModelMessage[];
    const prepared = prepareSubagentStep({
      ...step,
      stepNumber: 2,
      steps: [{ usage: { outputTokens: 200, inputTokens: 800 } }, { usage: { outputTokens: 200 } }],
      messages,
    });
    const serialized = JSON.stringify(prepared.messages);

    expect(prepared.toolChoice).toBe("none");
    expect(prepared.instructions).toContain("unfinished work");
    expect(serialized).toContain("Compare the lease options");
    expect(serialized).toContain("compacted to stay within 24k");
    expect(
      estimateTokenCountSync(`${prepared.instructions}\n[]\n${serialized}`)
    ).toBeLessThanOrEqual(SUBAGENT_MAX_INPUT_TOKENS);
  });

  test("a later step with one huge assignment compacts; a single huge step-0 message still throws", () => {
    const large = "a distinct piece of captured evidence. ".repeat(10_000);
    const prepared = prepareSubagentStep({
      ...step,
      stepNumber: 2,
      steps: [{ usage: { outputTokens: 40 } }, { usage: { outputTokens: 40 } }],
      messages: [{ role: "user", content: large }],
    });

    expect(prepared.toolChoice).toBe("none");
    expect(prepared.messages?.length).toBe(1);
    expect(
      estimateTokenCountSync(`${prepared.instructions}\n[]\n${JSON.stringify(prepared.messages)}`)
    ).toBeLessThanOrEqual(SUBAGENT_MAX_INPUT_TOKENS);
    expect(() =>
      prepareSubagentStep({
        ...step,
        stepNumber: 3,
        steps: [
          { usage: { outputTokens: 10 } },
          { usage: { outputTokens: 10 } },
          { usage: { outputTokens: 10 } },
        ],
        toolSchemaText: large,
      })
    ).toThrow("input exceeds its cost limit");
  });
});

function inputTokensCosting(modelId: string, usd: number): number {
  return Math.round((usd / getModelCost(modelId).inputPerMillion) * 1_000_000);
}

describe("per-run dollar ceiling", () => {
  const haiku = models.anthropic.haiku.id;

  test("spend near 80% forces a tool-free wrap-up and spend past the ceiling stops the run", () => {
    expect(SUBAGENT_MAX_RUN_COST_USD).toBe(0.25);
    const below = prepareSubagentStep({
      ...step,
      stepNumber: 1,
      steps: [{ usage: { inputTokens: inputTokensCosting(haiku, 0.16), outputTokens: 100 } }],
    });
    const wrapping = prepareSubagentStep({
      ...step,
      stepNumber: 1,
      steps: [{ usage: { inputTokens: inputTokensCosting(haiku, 0.21), outputTokens: 0 } }],
    });

    expect(below.toolChoice).toBeUndefined();
    expect(wrapping.toolChoice).toBe("none");
    expect(wrapping.instructions).toContain("unfinished work");
    expect(() =>
      prepareSubagentStep({
        ...step,
        stepNumber: 1,
        steps: [{ usage: { inputTokens: inputTokensCosting(haiku, 0.26), outputTokens: 0 } }],
      })
    ).toThrow(/allowance exhausted \(cost \$/);
    expect(() =>
      prepareSubagentStep({
        ...step,
        stepNumber: 1,
        steps: [{ usage: { inputTokens: inputTokensCosting(haiku, 0.1), outputTokens: 0 } }],
        modelId: models.anthropic.sonnet.id,
      })
    ).toThrow(/allowance exhausted \(cost \$/);
  });

  test("another full step that would cross the ceiling finishes before that call", () => {
    const sonnet = models.anthropic.sonnet.id;
    const spentUsd = 0.15;
    const next = prepareSubagentStep({
      ...step,
      stepNumber: 1,
      modelId: sonnet,
      steps: [{ usage: { inputTokens: inputTokensCosting(sonnet, spentUsd), outputTokens: 0 } }],
    });

    expect(spentUsd).toBeLessThan(SUBAGENT_MAX_RUN_COST_USD * 0.8);
    expect(next.toolChoice).toBe("none");
    expect(
      prepareSubagentStep({
        ...step,
        stepNumber: 1,
        steps: [{ usage: { inputTokens: inputTokensCosting(haiku, spentUsd), outputTokens: 0 } }],
      }).toolChoice
    ).toBeUndefined();
  });

  test("a lower caller ceiling still wraps up at 80% of that ceiling", () => {
    const wrapping = prepareSubagentStep({
      ...step,
      stepNumber: 1,
      maxRunCostUsd: 0.05,
      steps: [{ usage: { inputTokens: inputTokensCosting(haiku, 0.041), outputTokens: 0 } }],
    });

    expect(wrapping.toolChoice).toBe("none");
    expect(() =>
      prepareSubagentStep({
        ...step,
        stepNumber: 1,
        maxRunCostUsd: 0.05,
        steps: [{ usage: { inputTokens: inputTokensCosting(haiku, 0.051), outputTokens: 0 } }],
      })
    ).toThrow(/allowance exhausted \(cost \$/);
  });
});
