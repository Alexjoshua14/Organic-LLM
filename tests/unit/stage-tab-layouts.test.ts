import { expect, test } from "bun:test";

import { emptyStageState, STAGE_CONTENT_RECT, type StageWidget } from "@/lib/stage/schema";
import { applyStageOperations, repairStageLayout, validateStageLayouts } from "@/lib/stage/layout";
import { resolveStageFrame } from "@/lib/stage/frame";
import { placeStageWidget, stageWidgetRect } from "@/lib/stage/placements";
import { stageSpaceContext } from "@/lib/stage/views";
import { mergeStageDesignPlan } from "@/lib/stage/reconcile";
import { restoreStageLayout } from "@/lib/stage/restore";

const author = () => ({ id: crypto.randomUUID(), name: "Planner" });
const note = (source = author(), x = 8): StageWidget => ({
  id: crypto.randomUUID(),
  kind: "note",
  title: "Plan",
  text: "Useful work",
  source,
  rect: { x, y: 4, w: 11, h: 16 },
});
const size = { width: 1366, height: 768, composerHeight: 80 };

test("migration saves spacious per-tab layouts, repairing tiny legacy overview pieces only once", () => {
  const prep = note();
  const timing = { ...note(author(), 30), rect: { x: 30, y: 4, w: 1, h: 2 } };
  const state = repairStageLayout({ ...emptyStageState(), widgets: [prep, timing] });
  for (const widget of state.widgets) {
    expect(widget.layouts).toEqual({ author: STAGE_CONTENT_RECT, piece: STAGE_CONTENT_RECT });
    expect(widget.rect.w).toBeGreaterThanOrEqual(11);
    expect(widget.rect.h).toBe(18);
  }
  expect(() => validateStageLayouts(state.widgets)).not.toThrow();
  expect(repairStageLayout(state)).toBe(state);
  for (const widget of state.widgets) {
    const view = { kind: "author" as const, id: widget.source!.id };
    const frame = resolveStageFrame(state, { ...size, view, author: view.id });
    expect(frame.pieces.map((piece) => piece.widget.id)).toEqual([widget.id]);
    expect(frame.pieces[0].rect).toEqual(STAGE_CONTENT_RECT);
    expect(frame.pieces[0].widget.rect).toBe(widget.layouts!.author!);
  }
});

test("hidden authors can use the same cells; only siblings in the same view collide", () => {
  const one = note();
  const two = note(author(), 20);
  const state = repairStageLayout({ ...emptyStageState(), widgets: [one, two] });
  expect(state.widgets[0].layouts!.author).toEqual(state.widgets[1].layouts!.author);
  expect(() => validateStageLayouts(state.widgets)).not.toThrow();
  const sameAuthor = state.widgets.map((widget) => ({ ...widget, source: one.source }));
  expect(() => validateStageLayouts(sameAuthor)).toThrow();
  const repaired = repairStageLayout({ ...state, widgets: sameAuthor });
  expect(() => validateStageLayouts(repaired.widgets)).not.toThrow();
  expect(repaired.widgets[0].layouts!.author!.h).toBe(18);
});

test("moving one tab persists its own cells without changing overview or focused placement", () => {
  const original = note();
  const state = repairStageLayout({
    ...emptyStageState(),
    widgets: [original, note(author(), 20)],
  });
  const view = { kind: "author" as const, id: original.source!.id };
  const rect = { x: 10, y: 5, w: 20, h: 16 };
  const widgets = applyStageOperations(state.widgets, [
    { type: "move", id: original.id, view, rect },
  ]);
  expect(widgets[0].rect).toEqual(original.rect);
  expect(widgets[0].layouts).toEqual({ author: rect, piece: STAGE_CONTENT_RECT });
  expect(widgets[1]).toBe(state.widgets[1]);
  const saved = { ...state, widgets };
  expect(repairStageLayout(saved)).toBe(saved);
  const frame = resolveStageFrame(saved, { ...size, view, author: view.id });
  expect(frame.pieces[0].rect).toBe(widgets[0].layouts!.author!);
  expect(resolveStageFrame(saved, { ...size, pieceId: original.id }).pieces[0].rect).toEqual(
    STAGE_CONTENT_RECT
  );
  expect(() =>
    applyStageOperations(widgets, [
      { type: "move", id: original.id, view: { kind: "author", id: widgets[1].source!.id }, rect },
    ])
  ).toThrow();
  expect(() =>
    applyStageOperations(widgets, [
      { type: "move", id: original.id, view, rect: { x: 0, y: 0, w: 32, h: 32 } },
    ])
  ).toThrow();
});

test("agents see independent saved arrangements and designer moves target the intended tab", () => {
  const state = repairStageLayout({ ...emptyStageState(), widgets: [note(), note(author(), 20)] });
  const view = { kind: "author" as const, id: state.widgets[0].source!.id };
  const context = stageSpaceContext(state, { ...size, view });
  expect(context.visiblePieces[0].rect).toEqual(STAGE_CONTENT_RECT);
  expect(
    context.layouts.find((entry) => entry.view.id === state.widgets[1].source!.id)?.pieces[0].rect
  ).toEqual(STAGE_CONTENT_RECT);
  const rect = { x: 9, y: 5, w: 21, h: 16 };
  const result = mergeStageDesignPlan(
    state,
    state,
    { operations: [{ operation: "move", targetId: state.widgets[0].id, view, rect }] },
    new Map()
  );
  expect(stageWidgetRect(result[0], view)).toEqual(rect);
  expect(result[0].rect).toEqual(state.widgets[0].rect);
  expect(result[1]).toBe(state.widgets[1]);
  const changed = placeStageWidget(
    result[0],
    { kind: "piece", id: result[0].id },
    { ...rect, x: 10, w: 20 }
  );
  expect(changed.layouts!.author).toEqual(rect);
});

test("legacy worker recovery does not duplicate a long reply when it already published pieces", () => {
  const source = author();
  const original = note(source);
  const state = {
    ...emptyStageState(),
    widgets: [original],
    subagents: [
      {
        ...source,
        goal: "Plan",
        status: "done" as const,
        startedAt: new Date().toISOString(),
        result: "Long detailed plan. ".repeat(40),
        memory: false,
        webSearch: false,
      },
    ],
  };
  const restored = restoreStageLayout(state);
  expect(restored.widgets).toHaveLength(1);
  expect(restoreStageLayout(restored)).toBe(restored);
});
