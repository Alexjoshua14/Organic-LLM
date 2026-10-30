import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { StageSubagents } from "@/components/stage/stage-subagents";
import { assignStageSubagents, settleStageSubagent } from "@/lib/stage/subagent-state";
import { stageReservedRects, repairStageLayout, validateStageLayout } from "@/lib/stage/layout";
import { emptyStageState } from "@/lib/stage/schema";

const assignments = [
  { name: "Planner", goal: "Compare two ways to prepare the meal." },
  { name: "Reviewer", goal: "Check the plan for timing risks." },
];
afterEach(cleanup);

describe("Stage parallel specialist lifecycle", () => {
  test("enforces two active goals across successive turns and frees settled slots", () => {
    const first = assignStageSubagents(emptyStageState(), assignments);
    expect(first.subagents).toHaveLength(2);
    expect(assignStageSubagents(first, assignments)).toBe(first);
    expect(stageReservedRects(first)).toHaveLength(0);
    const done = settleStageSubagent(
      first,
      first.subagents![0].id,
      "done",
      "Prepare the dressing first."
    )!;
    const replacement = assignStageSubagents(done, assignments);
    expect(replacement.subagents).toHaveLength(2);
    expect(replacement.subagents!.some((agent) => agent.id === first.subagents![0].id)).toBe(false);
    expect(replacement.messages.at(-1)?.text).toContain("dressing first");
  });

  test("cancel wins against late success; settled children release all reserved space", () => {
    const initial = assignStageSubagents(emptyStageState(), [assignments[0]]);
    const canceling = {
      ...initial,
      subagents: initial.subagents!.map((agent) => ({ ...agent, status: "canceling" as const })),
    };
    const settled = settleStageSubagent(
      canceling,
      canceling.subagents![0].id,
      "done",
      "Late model answer"
    )!;
    expect(settled.subagents![0].status).toBe("canceled");
    expect(settled.subagents![0].result).toBeNull();
    expect(settled.messages.at(-1)?.text).toContain("stopped");
    expect(stageReservedRects(settled)).toEqual([]);
    expect(settleStageSubagent(settled, settled.subagents![0].id, "done", "Even later")).toBeNull();
  });

  test("moves only conflicting pieces out of the temporary child branch", () => {
    const state = emptyStageState();
    state.widgets = [
      {
        id: crypto.randomUUID(),
        kind: "note",
        title: "Keep this",
        text: "Content",
        rect: { x: 10, y: 21, w: 7, h: 6 },
      },
    ];
    const queued = assignStageSubagents(state, assignments);
    const withChildren = repairStageLayout({
      ...queued,
      subagents: queued.subagents!.map((agent, slot) => ({ ...agent, status: "working", slot })),
    });
    expect(withChildren.widgets[0].rect).not.toEqual(state.widgets[0].rect);
    expect(withChildren.widgets[0]).toMatchObject({ id: state.widgets[0].id, text: "Content" });
    expect(() =>
      validateStageLayout(withChildren.widgets, stageReservedRects(withChildren))
    ).not.toThrow();
  });

  test("shows Stop for active workers and settles outgoing cards after completion", async () => {
    const state = assignStageSubagents(emptyStageState(), [assignments[0]]);
    state.subagents = state.subagents!.map((agent) => ({ ...agent, status: "working", slot: 0 }));
    const cancel = mock(async (_id: string) => undefined);
    const view = render(<StageSubagents agents={state.subagents!} onCancel={cancel} />);
    fireEvent.click(view.getByRole("button", { name: "Stop Planner" }));
    expect(cancel).toHaveBeenCalledWith(state.subagents![0].id);
    view.rerender(
      <StageSubagents
        agents={state.subagents!.map((agent) => ({ ...agent, status: "done" }))}
        onCancel={cancel}
      />
    );
    await waitFor(() =>
      expect(Boolean(view.container.querySelector('[data-activity-state="complete"]'))).toBe(true)
    );
    expect(view.getByRole("button", { name: "Stop Planner" }).hasAttribute("disabled")).toBe(true);
  });
});
