import { afterEach, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import type { StageOperation, StageWidget } from "@/lib/stage/schema";

import { StageCollection, StageRecall } from "@/components/stage/stage-knowledge";

afterEach(cleanup);
const AT = "2026-11-13T08:00:00.000Z";
const collection: Extract<StageWidget, { kind: "collection" }> = {
  id: crypto.randomUUID(),
  kind: "collection",
  title: "Ideas",
  rect: { x: 8, y: 4, w: 7, h: 8 },
  items: [
    { id: crypto.randomUUID(), text: "Stage is the thinking surface", at: AT },
    { id: crypto.randomUUID(), text: "Recall on its own", at: AT },
  ],
};

test("collection items can be checked off and let go of in place", async () => {
  const onChange = mock(async (_operations: StageOperation[]) => true);
  const view = render(<StageCollection widget={collection} onChange={onChange} />);

  fireEvent.click(view.getByRole("button", { name: "Mark “Recall on its own” done" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  const [checked] = onChange.mock.calls[0][0];
  expect(checked).toMatchObject({ type: "upsert", widget: { id: collection.id } });
  if (checked.type === "upsert" && checked.widget.kind === "collection")
    expect(checked.widget.items.map((item) => !!item.done)).toEqual([false, true]);

  fireEvent.click(view.getByRole("button", { name: "Let go of “Stage is the thinking surface”" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  const [operation] = onChange.mock.calls[1][0];
  expect(operation.type === "upsert" && operation.widget.kind === "collection").toBe(true);
  if (operation.type === "upsert" && operation.widget.kind === "collection")
    expect(operation.widget.items.map((item) => item.text)).toEqual(["Recall on its own"]);
});

test("recall shows what memory surfaced, or says nothing matched", () => {
  const recall: Extract<StageWidget, { kind: "recall" }> = {
    id: crypto.randomUUID(),
    kind: "recall",
    title: "Recall",
    rect: { x: 16, y: 4, w: 7, h: 8 },
    query: "second brain",
    at: AT,
    items: [{ text: "Wants one place to think", at: AT }],
  };
  const view = render(<StageRecall widget={recall} />);
  expect(view.getByText("Wants one place to think")).toBeTruthy();
  view.rerender(<StageRecall widget={{ ...recall, items: [] }} />);
  expect(view.getByText("Nothing earlier matched this yet.")).toBeTruthy();
});
