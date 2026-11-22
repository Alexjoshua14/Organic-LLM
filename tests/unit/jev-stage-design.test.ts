import { describe, expect, test } from "bun:test";

import { rankJevDesignerBlocks } from "@/lib/jev-stage/designer-block-rank";
import { runJevStageDesign } from "@/lib/jev-stage/design";
import { emptyJevStageBundle } from "@/lib/jev-stage/schema";
import { DESIGN_PLAN } from "@/lib/stage/design-schema";

const identity = { ownerId: "owner", clerkUserId: "clerk" };
const jobId = "00000000-0000-4000-8000-000000000001";

function queuedDesign() {
  let bundle = emptyJevStageBundle();

  bundle.stage.design = {
    id: jobId,
    brief: "Show a simple SDK code sample.",
    status: "working",
    phase: "queued",
    startedAt: new Date().toISOString(),
  };

  return {
    get bundle() {
      return bundle;
    },
    runtime: {
      rank: async () => [],
      acquire: async () => "lease-token",
      release: async () => undefined,
      mutate: async (_ownerId: string, update: (current: typeof bundle) => typeof bundle) => {
        bundle = update(bundle);
        return bundle;
      },
    },
  };
}

describe("Jev Stage designer", () => {
  test("runs a persisted queued job, places a code block and opens overview", async () => {
    const fixture = queuedDesign();

    await runJevStageDesign(identity, jobId, {
      ...fixture.runtime,
      generate: async ({ state, brief, plainCodeExamples, blockTypes }) => {
        expect(state.design?.phase).toBe("working");
        expect(brief).toBe("Show a simple SDK code sample.");
        expect(plainCodeExamples).toBe(true);
        expect(blockTypes).toEqual([]);

        return {
          model: "test",
          usage: { inputTokens: 100, outputTokens: 50 },
          plan: DESIGN_PLAN.parse({
            fresh: true,
            operations: [
              {
                operation: "upsert",
                kind: "note",
                title: "SDK example",
                targetId: null,
                rect: null,
                view: null,
                text: "```ts\nexport const example = true;\n```",
                code: null,
                block: null,
                url: null,
                ingredients: null,
                steps: null,
              },
            ],
          }),
        };
      },
    });

    expect(fixture.bundle.stage.design).toBeNull();
    expect(fixture.bundle.stage.widgets).toMatchObject([
      { kind: "note", title: "SDK example", text: "```ts\nexport const example = true;\n```" },
    ]);
    expect(fixture.bundle.stage.viewCommand?.target.kind).toBe("overview");
  });

  test("retries an empty plan and publishes a visible failure after the second attempt", async () => {
    const fixture = queuedDesign();
    const feedback: Array<string | undefined> = [];

    await runJevStageDesign(identity, jobId, {
      ...fixture.runtime,
      generate: async (args) => {
        feedback.push(args.feedback);
        return {
          model: "test",
          usage: { inputTokens: 100, outputTokens: 0 },
          plan: { fresh: false, operations: [] },
        };
      },
    });

    expect(feedback).toEqual([undefined, "The designer returned no stage pieces."]);
    expect(fixture.bundle.stage.design).toMatchObject({ id: jobId, status: "failed" });
  });
});

test("Jev shortlists relevant schemas for a mixed brief and leaves plain code to native pieces", async () => {
  const ranked = await rankJevDesignerBlocks(
    "Show code examples and a rollout timeline.",
    async () => ({
      answers: {
        block: {
          choice: "native-piece",
          probabilities: { "native-piece": 0.69, "plan-timeline": 0.24, "code-diff": 0.07 },
        },
      },
    })
  );

  expect(ranked).toEqual(["plan-timeline"]);
});

test("Jev keeps the diff schema for a real patch and falls back when ranking is unavailable", async () => {
  expect(
    await rankJevDesignerBlocks("Show the patch between these versions.", async () => ({
      answers: { block: { choice: "code-diff" } },
    }))
  ).toEqual(["code-diff"]);
  expect(
    await rankJevDesignerBlocks("Draw a timeline.", async () => ({ answers: {} }))
  ).toBeUndefined();
});
