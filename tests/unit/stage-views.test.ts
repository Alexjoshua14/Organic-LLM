import { expect, test } from "bun:test";
import { emptyStageState } from "@/lib/stage/schema";
import { stageNavigation, stageSpaceContext, resolveStageView } from "@/lib/stage/views";
import { resolveStageFrame } from "@/lib/stage/frame";

const source = { id: crypto.randomUUID(), name: "Prep Planner" };
const widget = {
  id: crypto.randomUUID(),
  kind: "note" as const,
  title: "Prep checklist",
  text: "Chop the onion",
  rect: { x: 8, y: 4, w: 11, h: 16 },
  source,
};
const state = { ...emptyStageState(), widgets: [widget] };

test("navigation selects existing views and preserves the requested work", () => {
  for (const request of [
    "Show me the prep planner",
    "Please switch to Prep Planner's view.",
    "can you open the prep planner tab?",
  ])
    expect(stageNavigation(request, state)).toEqual({ kind: "author", id: source.id });
  expect(stageNavigation("go back to Organic", state)).toEqual({ kind: "organic", id: null });
  expect(stageNavigation("Show me the prep checklist", state)).toEqual({
    kind: "piece",
    id: widget.id,
  });
  expect(
    stageNavigation("I want to see the prep planner", {
      ...state,
      widgets: [{ ...widget, title: source.name }],
    })
  ).toEqual({ kind: "author", id: source.id });
  for (const request of [
    "show me the prep planner and update the recipe",
    "show me a new prep planner",
    "make a prep planner",
    "show me the missing worker",
  ])
    expect(stageNavigation(request, state)).toBeNull();
  expect(resolveStageView(state, { kind: "author", id: crypto.randomUUID() })).toBeNull();
  expect(resolveStageView(state, { kind: "organic", id: source.id })).toBeNull();
});

test("Organic centers the parent, response and composer and tucks existing pieces away", () => {
  const frame = resolveStageFrame(state, {
    width: 1366,
    height: 692,
    composerHeight: 78,
    home: true,
  });
  expect(frame.pieces).toHaveLength(0);
  expect(frame.showPieces).toBe(false);
  for (const rect of [frame.parent, frame.composer, frame.reply])
    expect(rect.x + rect.w / 2).toBe(16);
  expect(state.widgets[0]).toBe(widget);
  const restored = resolveStageFrame(state, {
    width: 1366,
    height: 692,
    composerHeight: 78,
    author: source.id,
  });
  expect(restored.pieces[0].widget).toBe(widget);
});

test("agent context describes the actual selection, viewport and owned work", () => {
  const context = stageSpaceContext(state, {
    width: 1100,
    height: 700,
    composerHeight: 80,
    view: { kind: "author", id: source.id },
  });
  expect(context.currentView).toEqual({ kind: "author", id: source.id });
  expect(context.availableViews.some((view) => view.name === source.name)).toBe(true);
  expect(context.viewport?.width).toBe(1100);
  expect(context.visiblePieces[0].id).toBe(widget.id);
  expect(
    stageSpaceContext(state, {
      width: 1100,
      height: 700,
      composerHeight: 80,
      view: { kind: "organic", id: null },
    }).visiblePieces
  ).toEqual([]);
});
