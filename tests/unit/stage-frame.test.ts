import { expect, test } from "bun:test";
import { resolveStageFrame, stageRectPixels } from "@/lib/stage/frame";
import {
  repairStageLayout,
  stageChromeReservations,
  validateStageLayout,
} from "@/lib/stage/layout";
import { emptyStageState, type StageRect, type StageWidget } from "@/lib/stage/schema";

const note = (x: number): StageWidget => ({
  id: crypto.randomUUID(),
  title: "Plan",
  kind: "note",
  text: "Useful work",
  rect: { x, y: 4, w: 11, h: 16 },
});
const intersects = (a: StageRect, b: StageRect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test("top-level Stage reservations include the latest response and composer", () => {
  for (const rect of stageChromeReservations)
    expect(() => validateStageLayout([{ ...note(8), rect }])).toThrow();
});

test("one grid fits its chrome and saved placements without overlap or coordinate projection", () => {
  const state = { ...emptyStageState(), widgets: [note(8), note(20)] };
  for (const [width, height] of [
    [1920, 900],
    [1286, 692],
    [852, 524],
    [358, 768],
  ]) {
    for (const composerHeight of [78, 190]) {
      for (const reading of [false, true]) {
        const frame = resolveStageFrame(state, { width, height, composerHeight, reading });
        expect(frame.rows).toHaveLength(32);
        expect(frame.rowOffsets.at(-1)).toBeCloseTo(height);
        const rects = [
          frame.header,
          frame.parent,
          ...frame.children,
          frame.reply,
          frame.composer,
          ...frame.pieces.map((p) => p.rect),
        ];
        for (const [i, rect] of rects.entries()) {
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.w).toBeLessThanOrEqual(32);
          expect(rect.y + rect.h).toBeLessThanOrEqual(32);
          expect(rects.slice(i + 1).some((other) => intersects(rect, other))).toBe(false);
        }
        if (!reading) {
          expect(frame.pieces.map((p) => p.rect)).toEqual(state.widgets.map((w) => w.rect));
          expect(stageRectPixels(frame, frame.pieces[0].rect).h).toBeGreaterThan(180);
        } else expect(stageRectPixels(frame, frame.reply).h).toBeGreaterThan(200);
        expect(stageRectPixels(frame, frame.composer).h).toBeCloseTo(composerHeight);
      }
    }
  }
});

test("each view renders its saved cells without projection, and repeated selection is stable", () => {
  const source = { id: crypto.randomUUID(), name: "Timing checker" };
  const state = repairStageLayout({
    ...emptyStageState(),
    widgets: [note(8), { ...note(20), source }],
  });
  const options = { width: 1200, height: 700, composerHeight: 78 };
  for (const extra of [{}, { author: source.id }, { pieceId: state.widgets[1].id }]) {
    const frame = resolveStageFrame(state, { ...options, ...extra });
    const piece = frame.pieces.find((p) => p.widget.id === state.widgets[1].id)!;
    const expected =
      "author" in extra
        ? state.widgets[1].layouts!.author!
        : "pieceId" in extra
          ? state.widgets[1].layouts!.piece!
          : state.widgets[1].rect;
    expect(piece.rect).toBe(expected);
    expect(stageRectPixels(frame, piece.rect)).toEqual(
      stageRectPixels(resolveStageFrame(state, { ...options, ...extra }), expected)
    );
  }
});

test("small saved pieces are not silently enlarged by a readability fallback", () => {
  const widget = { ...note(8), rect: { x: 13, y: 9, w: 4, h: 5 } };
  const state = { ...emptyStageState(), widgets: [widget] };
  const frame = resolveStageFrame(state, {
    width: 1366,
    height: 692,
    composerHeight: 80,
    pieceId: widget.id,
  });
  expect(frame.pieces[0].rect).toBe(widget.rect);
  expect(frame.gridLines).toContain(`${Number(frame.rowOffsets[widget.rect.y].toFixed(3))}px`);
});

test("legacy repair retains all content and rendering uses the repaired rectangles verbatim", () => {
  const state = { ...emptyStageState(), widgets: Array.from({ length: 48 }, () => note(8)) };
  const restored = repairStageLayout(state);
  expect(restored.widgets.map((w) => w.id)).toEqual(state.widgets.map((w) => w.id));
  expect(() => validateStageLayout(restored.widgets)).not.toThrow();
  const frame = resolveStageFrame(restored, { width: 1200, height: 700, composerHeight: 78 });
  expect(frame.pieces.map((p) => p.rect)).toEqual(restored.widgets.map((w) => w.rect));
});
