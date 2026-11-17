import { afterEach, expect, test } from "bun:test";
import { cleanup, render, within } from "@testing-library/react";
import { StageResponse } from "@/components/stage/stage-response";
import { emptyStageState } from "@/lib/stage/schema";

afterEach(cleanup);
test("the reading surface shows the selected author's own words, and Organic's by default", () => {
  const planner = { id: crypto.randomUUID(), name: "Planner", kind: "subagent" as const };
  const state = emptyStageState();
  state.messages = [
    { id: crypto.randomUUID(), role: "assistant", text: "Organic is coordinating." },
    { id: crypto.randomUUID(), role: "assistant", text: "My independent result.", author: planner },
  ];
  const view = render(<StageResponse state={state} />);
  expect(view.getByRole("region", { name: "Organic’s response" }).textContent).toContain(
    "coordinating"
  );
  expect(view.queryByText("My independent result.")).toBeNull();
  // No author tabs or piece navigation: the surface is only the words. Scoped to this render,
  // since the default queries cover the whole document and another file's leftovers.
  expect(within(view.container).queryAllByRole("button")).toHaveLength(0);

  view.rerender(<StageResponse state={state} selectedAuthor={planner.id} />);
  expect(view.getByRole("region", { name: "Planner’s response" }).textContent).toContain(
    "independent result"
  );
  expect(view.queryByText("Organic is coordinating.")).toBeNull();

  // An author with nothing said or placed falls back to Organic rather than an empty surface.
  view.rerender(<StageResponse state={state} selectedAuthor={crypto.randomUUID()} />);
  expect(view.getByRole("region", { name: "Organic’s response" })).toBeTruthy();
});

test("a working specialist that hasn't spoken shows what it is doing; expanding is opt-in", () => {
  const id = crypto.randomUUID();
  const state = emptyStageState();
  state.subagents = [
    {
      id,
      name: "Researcher",
      goal: "Compare three approaches",
      status: "working",
      startedAt: new Date().toISOString(),
      result: null,
      slot: 0,
      memory: false,
      webSearch: false,
    },
  ];
  const view = render(
    <StageResponse state={state} selectedAuthor={id} onToggleExpanded={() => undefined} />
  );
  expect(view.getByRole("region", { name: "Researcher’s response" }).textContent).toContain(
    "Working on: Compare three approaches"
  );
  expect(view.getByRole("button", { name: "Give response more room" })).toBeTruthy();
});
