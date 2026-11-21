import { describe, expect, test } from "bun:test";
import { gateway } from "@ai-sdk/gateway";
import { experimental_decide } from "ai";
import { Experimental_DecisionMockModelV4 } from "ai/test";

import {
  createJevGenerate,
  defaultJevGenerate,
  jevCallCostUsd,
  jevDecide,
  jevIf,
  readJevChoice,
  readJevProbability,
  type JevGenerate,
} from "@/lib/llm/jev";

type DoDecideOptions = {
  state: unknown;
  questions: Record<string, unknown>;
  maxOutputTokens?: number;
  providerOptions?: Record<string, unknown>;
};

function mockModel(answers: Record<string, unknown>, seen: DoDecideOptions[] = []) {
  return new Experimental_DecisionMockModelV4({
    modelId: "typesafe-ai/jev",
    doDecide: async (options: DoDecideOptions) => {
      seen.push(options);

      return {
        answers,
        usage: { inputTokens: 1000, outputTokens: 4 },
        warnings: [],
        providerMetadata: { gateway: { cost: "0.000042" } },
      };
    },
  } as never);
}

describe("Jev decision API", () => {
  test("the Gateway exposes a decision model for Jev", () => {
    const model = gateway.decisionModel("typesafe-ai/jev") as unknown as {
      modelId: string;
      specificationVersion: string;
    };

    expect(model.modelId).toBe("typesafe-ai/jev");
  });

  test("experimental_decide passes ZDR and the questions through, with no output cap", async () => {
    const seen: DoDecideOptions[] = [];
    const model = mockModel(
      {
        action: { type: "choice", choice: "respond", probabilities: { respond: 0.7, recall: 0.3 } },
      },
      seen
    );
    const result = await experimental_decide({
      model,
      state: { message: "hi" },
      questions: {
        action: {
          type: "choice",
          instructions: "Pick one.",
          criteria: { respond: "Answer the user", recall: "Refresh recall" },
        },
      },
      providerOptions: { gateway: { zeroDataRetention: true } },
    });

    expect(seen[0]?.providerOptions).toEqual({ gateway: { zeroDataRetention: true } });
    expect(seen[0]?.maxOutputTokens).toBeUndefined();
    expect(readJevChoice(result.answers.action, ["respond", "recall"] as const)).toEqual({
      choice: "respond",
      probabilities: { respond: 0.7, recall: 0.3 },
    });
  });

  test("jevDecide forces ZDR, never sets maxOutputTokens, and prices from Gateway cost", async () => {
    let captured: Parameters<JevGenerate>[0] | null = null;
    const generate: JevGenerate = async (args) => {
      captured = args;

      return {
        answers: { yes: { type: "boolean", probability: 0.8 } },
        usage: { inputTokens: 2000, outputTokens: 3 },
        providerMetadata: { gateway: { cost: 0.0001 } },
      };
    };
    const result = await jevDecide({
      label: "test",
      state: { context: "x" },
      questions: { yes: { type: "boolean", instructions: "Yes?" } },
      attribution: { user: "owner-1" },
      generate,
    });

    expect(captured!.model).toBe("typesafe-ai/jev");
    expect(captured!.providerOptions.gateway.zeroDataRetention).toBe(true);
    expect(captured!.providerOptions.gateway.user).toBe("owner-1");
    expect("maxOutputTokens" in captured!).toBe(false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usage).toEqual({ inputTokens: 2000, outputTokens: 3 });
      expect(result.costUsd).toBe(0.0001);
    }
  });

  test("cost falls back to input tokens at the Jev rate; output is free", () => {
    expect(jevCallCostUsd({ inputTokens: 1_000_000 })).toBeCloseTo(0.042, 6);
    expect(jevCallCostUsd({ inputTokens: 0 }, { gateway: { cost: "0.5" } })).toBe(0.5);
    expect(jevCallCostUsd(undefined, { gateway: { cost: "nope" } })).toBe(0);
  });

  test("jevDecide resolves to a failure instead of throwing", async () => {
    const result = await jevDecide({
      label: "boom",
      state: "x",
      questions: { yes: { type: "boolean" } },
      generate: async () => {
        throw new Error("refused");
      },
    });

    expect(result.ok).toBe(false);
  });

  test("readers reject unknown choices and missing probabilities", () => {
    expect(readJevChoice({ choice: "nope" }, ["a", "b"] as const)).toBeNull();
    expect(readJevChoice({ choice: "a" }, ["a", "b"] as const)).toEqual({
      choice: "a",
      probabilities: {},
    });
    expect(readJevProbability({})).toBeNull();
    expect(readJevProbability({ probability: 0.25 })).toBe(0.25);
  });

  test("jevIf reads P(true) and falls back when Jev fails", async () => {
    const yes = await jevIf({
      label: "if",
      question: "Is it?",
      context: "ctx",
      fallback: false,
      generate: async () => ({ answers: { answer: { type: "boolean", probability: 0.62 } } }),
    });

    expect(yes).toEqual({ yes: true, reason: "Jev P(yes) 0.62", source: "jev" });

    const failed = await jevIf({
      label: "if",
      question: "Is it?",
      context: "ctx",
      fallback: true,
      generate: async () => {
        throw new Error("down");
      },
    });

    expect(failed.source).toBe("fallback");
    expect(failed.yes).toBe(true);
  });

  test("the live generate path runs through experimental_decide end to end", async () => {
    const seen: DoDecideOptions[] = [];
    const model = mockModel(
      { answer: { type: "boolean", probability: 0.3 } },
      seen
    );
    let resolved = "";
    const result = await jevIf({
      label: "live",
      question: "Is it?",
      context: "ctx",
      fallback: true,
      generate: createJevGenerate((id) => {
        resolved = id;

        return model;
      }),
    });

    expect(typeof defaultJevGenerate).toBe("function");
    expect(resolved).toBe("typesafe-ai/jev");
    expect(seen[0]?.maxOutputTokens).toBeUndefined();
    expect(seen[0]?.providerOptions).toEqual({ gateway: { zeroDataRetention: true } });
    expect(seen[0]?.questions.answer).toMatchObject({ type: "boolean" });
    expect(result).toEqual({ yes: false, reason: "Jev P(yes) 0.30", source: "jev" });
  });
});
