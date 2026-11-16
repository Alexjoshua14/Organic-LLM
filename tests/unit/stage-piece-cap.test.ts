import { expect, test } from "bun:test";

import { makeRoomForPieces, mergeStageDesignPlan, STAGE_MAX_PIECES } from "@/lib/stage/reconcile";
import { emptyStageState, type StageWidget } from "@/lib/stage/schema";
import { validateStageLayout } from "@/lib/stage/layout";
import { restoreStageLayout } from "@/lib/stage/restore";

const note = (title: string, x: number, y: number): StageWidget => ({
  id: crypto.randomUUID(),
  kind: "note",
  title,
  text: title,
  rect: { x, y, w: 5, h: 8 },
});
const collection: StageWidget = {
  id: crypto.randomUUID(),
  kind: "collection",
  title: "Ideas",
  rect: { x: 26, y: 4, w: 6, h: 8 },
  items: [],
};

test("making room removes the oldest untouched pieces, never collections", () => {
  const old = [collection, note("a", 8, 4), note("b", 14, 4), note("c", 20, 4)];
  const kept = makeRoomForPieces(old, 2, new Set([old[1].id]));

  expect(kept.map((w) => w.title)).toEqual(["Ideas", "a"]);
  expect(kept.length + 2).toBe(STAGE_MAX_PIECES);
  expect(makeRoomForPieces(old, 0)).toHaveLength(4);
});

test("a designer plan on a full stage replaces older pieces instead of piling up", () => {
  const state = {
    ...emptyStageState(),
    widgets: [note("soup", 8, 4), note("timeline", 14, 4), note("prep", 20, 4), note("tips", 26, 4)],
  };
  const upsert = (title: string) => ({
    operation: "upsert" as const,
    kind: "note" as const,
    title,
    targetId: null,
    rect: null,
    view: null,
    text: title,
    code: null,
    block: null,
    url: null,
    ingredients: null,
    steps: null,
  });
  const merged = mergeStageDesignPlan(
    state,
    state,
    { fresh: false, operations: [upsert("skill swap"), upsert("first meetup")] },
    new Map()
  );

  expect(merged).toHaveLength(STAGE_MAX_PIECES);
  expect(merged.map((w) => w.title)).toEqual(["prep", "tips", "skill swap", "first meetup"]);
  // The freed stage is re-tiled evenly: every piece gets a readable share, none overlap.
  for (const widget of merged) {
    expect(widget.rect.w).toBeGreaterThanOrEqual(11);
    expect(widget.rect.h).toBeGreaterThanOrEqual(8);
  }
  expect(() => validateStageLayout(merged)).not.toThrow();
});

test("reading a crowded stage never removes pieces", () => {
  const widgets = Array.from({ length: 6 }, (_, i) => note(`n${i}`, 8 + (i % 3) * 8, 4 + Math.floor(i / 3) * 9));
  const restored = restoreStageLayout({ ...emptyStageState(), widgets });

  expect(restored.widgets).toHaveLength(6);
});

test("a fresh topic clears every untouched piece except collections, in one step", () => {
  const state = {
    ...emptyStageState(),
    widgets: [note("soup", 8, 4), note("timeline", 14, 4), collection],
  };
  const merged = mergeStageDesignPlan(
    state,
    state,
    {
      fresh: true,
      operations: [
        {
          operation: "upsert",
          kind: "note",
          title: "skill swap",
          targetId: null,
          rect: null,
          view: null,
          text: "What it is",
          code: null,
          block: null,
          url: null,
          ingredients: null,
          steps: null,
        },
      ],
    },
    new Map()
  );

  expect(merged.map((w) => w.title)).toEqual(["Ideas", "skill swap"]);
  expect(() => validateStageLayout(merged)).not.toThrow();
});

