import { expect, test } from "bun:test";

import { resolveStageFrame } from "@/lib/stage/frame";
import { stageChromeReservations, validateStageLayout } from "@/lib/stage/layout";
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

test("fits content, agents, reading and a growing composer in one viewport without overlap", () => {
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
          expect(frame.pieces.length).toBeGreaterThan(0);
          expect((frame.pieces[0].rect.h * height) / 32).toBeGreaterThanOrEqual(
            composerHeight > 110 ? 128 : 200
          );
        } else expect((frame.reply.h * height) / 32).toBeGreaterThan(200);
      }
    }
  }
});

test("focus gives a selected author's piece the reading area and pages excess work", () => {
  const source = { id: crypto.randomUUID(), name: "Timing checker" };
  const state = { ...emptyStageState(), widgets: [note(8), { ...note(20), source }, note(8)] };
  const frame = resolveStageFrame(state, {
    width: 1200,
    height: 700,
    composerHeight: 78,
    author: source.id,
  });
  expect(frame.pieces).toHaveLength(1);
  expect(frame.pieces[0].widget.source?.id).toBe(source.id);
  expect(frame.pages).toBe(3);
  expect(frame.pieces[0].rect.w).toBe(24);
  const next = resolveStageFrame(state, { width: 1200, height: 700, composerHeight: 78, page: 2 });
  expect(next.pieces[0].widget.id).toBe(state.widgets[2].id);
});
