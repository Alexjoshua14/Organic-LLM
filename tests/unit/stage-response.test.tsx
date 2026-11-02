import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { StageResponse } from "@/components/stage/stage-response";
import { emptyStageState } from "@/lib/stage/schema";

afterEach(cleanup);
test("independent replies keep their authors and do not overwrite the current reading surface", () => {
  const state = emptyStageState();
  state.messages = [
    { id: crypto.randomUUID(), role: "assistant", text: "Organic is coordinating." },
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "My independent result.",
      author: { id: crypto.randomUUID(), name: "Planner", kind: "subagent" },
    },
  ];
  const view = render(<StageResponse state={state} onOpenConversation={() => undefined} />);
  expect(view.getByRole("region", { name: "Organic’s response" }).textContent).toContain(
    "coordinating"
  );
  fireEvent.click(view.getByRole("button", { name: /Planner/ }));
  expect(view.getByRole("region", { name: "Planner’s response" }).textContent).toContain(
    "independent result"
  );
  expect(view.queryByText("Organic is coordinating.")).toBeNull();
  view.rerender(
    <StageResponse
      state={{
        ...state,
        messages: [
          ...state.messages,
          ...["Reviewer", "Checker"].map((name) => ({
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text: `${name} result`,
            author: { id: crypto.randomUUID(), name, kind: "subagent" as const },
          })),
        ],
      }}
      onOpenConversation={() => undefined}
    />
  );
  expect(view.getByRole("region", { name: "Planner’s response" }).textContent).toContain(
    "independent result"
  );
  expect(view.getAllByRole("button", { name: /Planner|Checker|Organic/ })).toHaveLength(3);
});
