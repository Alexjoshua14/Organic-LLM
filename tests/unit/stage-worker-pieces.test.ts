import { expect, test } from "bun:test";
import { assignStageSubagents, settleStageSubagent } from "@/lib/stage/subagent-state";
import { emptyStageState } from "@/lib/stage/schema";
import { validateStageLayout } from "@/lib/stage/layout";
import { restoreStageLayout } from "@/lib/stage/restore";
import type { StageWorkerPiece } from "@/lib/stage/worker-output";

const recipe: StageWorkerPiece = {
  kind: "recipe",
  title: "Soup for four",
  ingredients: ["1 squash", "1 onion"],
  steps: ["Soften onion", "Simmer squash", "Blend"],
  text: null,
  code: null,
};

test("completed specialists publish attributed useful pieces and an independent brief reply", () => {
  const state = assignStageSubagents(emptyStageState(), [
    { name: "Prep planner", goal: "Plan soup" },
  ]);
  const id = state.subagents![0].id;
  const done = settleStageSubagent(state, id, "done", "The prep plan is ready.", [recipe])!;
  expect(done.widgets[0]).toMatchObject({
    kind: "recipe",
    source: { id, name: "Prep planner" },
    recipe: { title: "Soup for four", steps: recipe.steps },
  });
  expect(done.messages.at(-1)).toMatchObject({ text: "The prep plan is ready.", author: { id } });
  expect(() => validateStageLayout(done.widgets)).not.toThrow();
  expect(restoreStageLayout(done).widgets).toHaveLength(1);
});

test("cancellation cannot publish late pieces", () => {
  const state = assignStageSubagents(emptyStageState(), [{ name: "Planner", goal: "Plan" }]);
  state.subagents![0].status = "canceling";
  const done = settleStageSubagent(state, state.subagents![0].id, "done", "Late result", [recipe])!;
  expect(done.widgets).toHaveLength(0);
  expect(done.messages.at(-1)?.text).toContain("stopped");
});

test("restores long legacy worker output to a readable grid note once", () => {
  const state = assignStageSubagents(emptyStageState(), [
    { name: "Timing checker", goal: "Check timing" },
  ]);
  state.subagents![0].status = "done";
  state.subagents![0].result = "A useful timing check. ".repeat(30);
  const restored = restoreStageLayout(state);
  expect(restored.widgets[0]).toMatchObject({
    kind: "note",
    source: { id: state.subagents![0].id },
  });
  expect(restoreStageLayout(restored).widgets).toHaveLength(1);
});
