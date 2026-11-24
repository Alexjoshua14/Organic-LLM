import { describe, expect, test } from "bun:test";

import { JEV_STAGE_CONFIDENCE_FLOOR } from "@/lib/jev-stage/constants";
import { pickJevStageAction, routeJevStage } from "@/lib/jev-stage/router";
import type { JevGenerate } from "@/lib/llm/jev";
import { emptyStageState } from "@/lib/stage/schema";

describe("jev-stage router", () => {
  test("picks the highest confidence above the floor", () => {
    const picked = pickJevStageAction({
      candidates: [
        { kind: "respond", confidence: 0.4, reason: "chat", args: {} },
        { kind: "view_switch", confidence: 0.82, reason: "show overview", args: {} },
        { kind: "web_search", confidence: 0.6, reason: "lookup", args: {} },
      ],
    });

    expect(picked.fellBack).toBe(false);
    expect(picked.selected.kind).toBe("view_switch");
    expect(picked.ranked[0]?.kind).toBe("view_switch");
  });

  test("falls back to respond below the confidence floor", () => {
    const picked = pickJevStageAction({
      candidates: [
        { kind: "orchestrate", confidence: JEV_STAGE_CONFIDENCE_FLOOR - 0.01, reason: "maybe", args: {} },
      ],
    });

    expect(picked.fellBack).toBe(true);
    expect(picked.selected.kind).toBe("respond");
  });

  test("a top pick of respond runs as a normal Jev decision even below the floor", () => {
    const picked = pickJevStageAction({
      candidates: [
        { kind: "respond", confidence: JEV_STAGE_CONFIDENCE_FLOOR - 0.1, reason: "chat", args: {} },
        { kind: "memory_search", confidence: 0.17, reason: "memory", args: {} },
      ],
    });

    expect(picked.fellBack).toBe(false);
    expect(picked.selected.kind).toBe("respond");
  });

  test("routeJevStage uses injected generate and falls back on failure", async () => {
    const generate: JevGenerate = async () => {
      throw new Error("timeout");
    };
    const routed = await routeJevStage({
      message: "hello",
      summary: "",
      knowledgeHint: "",
      generate,
    });

    expect(routed.source).toBe("fallback");
    expect(routed.selected.kind).toBe("respond");
    expect(routed.fellBack).toBe(true);
    expect(routed.costUsd).toBe(0);
  });

  test("asks one choice question over the actions and ranks by probability", async () => {
    let questions: Parameters<JevGenerate>[0]["questions"] = {};
    const generate: JevGenerate = async (args) => {
      questions = args.questions;

      return {
        answers: {
          action: {
            type: "choice",
            choice: "captures",
            probabilities: { captures: 0.71, respond: 0.2, recall: 0.09 },
          },
        },
        usage: { inputTokens: 1200, outputTokens: 2 },
      };
    };
    const routed = await routeJevStage({
      message: "dump these ideas: tide clock, moss lamp",
      summary: "",
      knowledgeHint: "",
      generate,
    });

    expect(Object.keys(questions)).toEqual(["action"]);
    expect(questions.action).toMatchObject({ type: "choice" });
    expect(Object.keys((questions.action as { criteria: object }).criteria)).toContain("orchestrate");
    expect(routed.source).toBe("jev");
    expect(routed.selected.kind).toBe("captures");
    expect(routed.selected.confidence).toBe(0.71);
    expect(routed.selected.args).toEqual({
      captures: [{ text: "dump these ideas: tide clock, moss lamp" }],
    });
    expect(routed.ranked.map((c) => c.kind)).toEqual(["captures", "respond", "recall"]);
    expect(routed.usage).toEqual({ inputTokens: 1200, outputTokens: 2 });
    expect(routed.costUsd).toBeCloseTo((1200 / 1_000_000) * 0.042, 10);
  });

  test("without probabilities the chosen action is the only candidate", async () => {
    const routed = await routeJevStage({
      message: "research and write a brief",
      summary: "",
      knowledgeHint: "",
      generate: async () => ({ answers: { action: { type: "choice", choice: "orchestrate" } } }),
    });

    expect(routed.ranked).toHaveLength(1);
    expect(routed.selected.kind).toBe("orchestrate");
    expect(routed.selected.confidence).toBe(1);
  });

  test("an unknown choice falls back to respond", async () => {
    const routed = await routeJevStage({
      message: "hi",
      summary: "",
      knowledgeHint: "",
      generate: async () => ({ answers: { action: { type: "choice", choice: "teleport" } } }),
    });

    expect(routed.source).toBe("fallback");
    expect(routed.selected.kind).toBe("respond");
  });

  test("view_switch takes its view from a second choice over the Stage's views", async () => {
    let viewCriteria: Record<string, string> = {};
    const routed = await routeJevStage({
      message: "can we look at everything side by side",
      summary: "",
      knowledgeHint: "",
      stage: emptyStageState(),
      generate: async (args) => {
        viewCriteria = (args.questions.view as { criteria: Record<string, string> }).criteria;

        return {
          answers: {
            action: { type: "choice", choice: "view_switch", probabilities: { view_switch: 0.8 } },
            view: { type: "choice", choice: "v1", probabilities: { v0: 0.1, v1: 0.9 } },
          },
        };
      },
    });

    expect(Object.keys(viewCriteria)).toEqual(["v0", "v1"]);
    expect(routed.selected.kind).toBe("view_switch");
    expect(routed.selected.args).toEqual({ view: { kind: "overview", id: null } });
  });

  test("an unambiguous navigation command resolves the view without a view question", async () => {
    let asked: string[] = [];
    const routed = await routeJevStage({
      message: "go to the overview",
      summary: "",
      knowledgeHint: "",
      stage: emptyStageState(),
      generate: async (args) => {
        asked = Object.keys(args.questions);

        return {
          answers: {
            action: { type: "choice", choice: "view_switch", probabilities: { view_switch: 0.9 } },
          },
        };
      },
    });

    expect(asked).toEqual(["action"]);
    expect(routed.selected.args).toEqual({ view: { kind: "overview", id: null } });
  });
});

test("a correction targets only the owner’s clearly selected active worker", async () => {
  const worker = { turnId: crypto.randomUUID(), goal: "Compare walking routes" };
  const activeWorkers = [worker, { turnId: crypto.randomUUID(), goal: "Look up dinner options" }];
  const route = (choice: string, probability: number) =>
    routeJevStage({
      activeWorkers,
      message: "Use bike paths for that route comparison",
      summary: "",
      knowledgeHint: "",
      generate: async ({ questions }) => {
        expect(questions.correction).toBeDefined();
        return {
          answers: {
            action: { type: "choice", choice: "respond" },
            correction: { type: "choice", choice, probabilities: { [choice]: probability } },
          },
        };
      },
    });

  expect((await route("worker0", 0.9)).correctionTarget).toBe(worker.turnId);
  expect((await route("worker0", 0.6)).correctionTarget).toBeUndefined();
  expect((await route("independent", 0.95)).correctionTarget).toBeUndefined();
});
