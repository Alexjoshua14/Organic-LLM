import { describe, expect, test } from "bun:test";

import {
  applyStageOperations,
  findStagePlacement,
  StageLayoutError,
  validateStageLayout,
} from "@/lib/stage/layout";
import type { StageWidget } from "@/lib/stage/schema";

const note = (id: string, x: number, y: number): StageWidget => ({
  id,
  kind: "note",
  title: "Note",
  text: "Hello",
  rect: { x, y, w: 4, h: 4 },
});
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("stage placement", () => {
  test("preserves a one-cell gap and the agent and top-level chrome reservations", () => {
    expect(() => validateStageLayout([note(A, 8, 4), note(B, 12, 4)])).toThrow(StageLayoutError);
    expect(() => validateStageLayout([note(A, 0, 6)])).toThrow(StageLayoutError);
    expect(() => validateStageLayout([note(A, 8, 4), note(B, 13, 4)])).not.toThrow();
  });

  test("finds a valid placement around existing widgets", () => {
    const widgets = [note(A, 8, 4)];
    const rect = findStagePlacement(widgets, 4, 4);
    expect(rect).toEqual({ x: 13, y: 4, w: 4, h: 4 });
  });

  test("keeps chat identity immutable across upserts", () => {
    const chat: StageWidget = {
      id: A,
      kind: "chat",
      title: "Chat",
      rect: { x: 8, y: 4, w: 4, h: 4 },
      threadId: A,
    };
    expect(() =>
      applyStageOperations([chat], [{ type: "upsert", widget: { ...chat, threadId: B } }])
    ).toThrow(StageLayoutError);
    expect(() => applyStageOperations([], [{ type: "upsert", widget: chat }])).toThrow(
      StageLayoutError
    );
    expect(
      applyStageOperations([chat], [{ type: "move", id: A, rect: { x: 13, y: 4, w: 4, h: 4 } }])[0]
    ).toMatchObject({ threadId: A });
  });
});
