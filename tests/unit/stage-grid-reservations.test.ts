import { expect, test } from "bun:test";

import {
  availableStageChildSlot,
  repairStageLayout,
  stageAgentReservations,
  stageReservedRects,
  validateStageLayout,
} from "@/lib/stage/layout";
import { placeStageArtifacts, stageCaptionText } from "@/lib/stage/artifacts";
import { assignStageSubagents } from "@/lib/stage/subagent-state";
import { emptyStageState } from "@/lib/stage/schema";

function workingState() {
  const state = assignStageSubagents(emptyStageState(), [{ name: "Planner", goal: "Plan" }]);
  return {
    ...state,
    subagents: state.subagents!.map((agent) => ({ ...agent, status: "working" as const, slot: 1 })),
  };
}

test("the designer and workers share two owned child slots, separate from the parent", () => {
  const state = workingState();
  state.design = {
    id: crypto.randomUUID(),
    status: "working",
    phase: "working",
    slot: 0,
    brief: "Arrange the canvas",
    startedAt: new Date().toISOString(),
  };
  expect(stageAgentReservations(state)).toHaveLength(3);
  expect(availableStageChildSlot(state)).toBeNull();
  const next = { ...state, design: null };
  expect(availableStageChildSlot(next)).toBe(0);
  expect(stageAgentReservations(next).find((entry) => entry.kind === "subagent")?.slot).toBe(1);
  expect(() => validateStageLayout([], stageReservedRects(state))).not.toThrow();
});

test("repairs a piece occupying a parent's caption cells without losing its content", () => {
  const state = emptyStageState();
  state.widgets = [
    {
      id: crypto.randomUUID(),
      title: "Preserve",
      kind: "note",
      text: "User content",
      rect: { x: 12, y: 16, w: 8, h: 5 },
    },
  ];
  const fixed = repairStageLayout(state);
  expect(fixed.widgets[0].rect).not.toEqual(state.widgets[0].rect);
  expect(fixed.widgets[0]).toMatchObject({ id: state.widgets[0].id, text: "User content" });
  expect(() => validateStageLayout(fixed.widgets)).not.toThrow();
});

test("generated Mermaid artifacts receive grid cells while captions stay prose-only", () => {
  const text = "Here is the process.\n\n```mermaid\nflowchart TD\n A --> B\n```";
  const state = placeStageArtifacts(workingState(), text, "Planner");
  expect(state.widgets).toHaveLength(1);
  expect(state.widgets[0].kind).toBe("mermaid");
  expect(() => validateStageLayout(state.widgets, stageReservedRects(state))).not.toThrow();
  expect(stageCaptionText(text, true)).not.toContain("```");
  expect(stageCaptionText(text, true)).toContain("Diagram on the stage");
});
