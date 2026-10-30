import { afterEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { StageInspector } from "@/components/stage/stage-inspector";
import { emptyStageState, type StageWidget } from "@/lib/stage/schema";

afterEach(cleanup);

test("debounces valid geometry previews, retains saved content, and rejects collisions", async () => {
  const widget: StageWidget = {
    id: crypto.randomUUID(),
    title: "Plan",
    kind: "note",
    text: "Saved text",
    rect: { x: 8, y: 4, w: 7, h: 6 },
  };
  const state = {
    ...emptyStageState(),
    widgets: [widget, { ...widget, id: crypto.randomUUID(), rect: { ...widget.rect, x: 16 } }],
  };
  const preview = mock(() => undefined);
  const save = mock(async () => true);
  const close = mock(() => undefined);
  const view = render(
    <StageInspector
      widget={widget}
      state={state}
      saving={false}
      onPreview={preview}
      onChange={save}
      onClose={close}
    />
  );
  fireEvent.change(view.getByLabelText("Row"), { target: { value: "12" } });
  fireEvent.change(view.getByLabelText("Row"), { target: { value: "13" } });
  fireEvent.change(view.getByLabelText("Row"), { target: { value: "14" } });
  expect(preview).not.toHaveBeenCalled();
  await waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
  expect(preview).toHaveBeenLastCalledWith({ ...widget.rect, y: 13 });
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(view.getByLabelText("Row"), { target: { value: "5" } });
  fireEvent.change(view.getByLabelText("Column"), { target: { value: "17" } });
  await waitFor(() => expect(view.getByRole("status").textContent).toContain("needs free cells"));
  expect(preview).toHaveBeenCalledTimes(1);
  expect(widget.rect.y).toBe(4);
  fireEvent.click(view.getByRole("button", { name: "Close arrangement" }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
});
