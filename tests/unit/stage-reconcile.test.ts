import { describe, expect, test } from "bun:test";

import type { DesignPlan } from "@/lib/stage/agent";
import { StageLayoutError } from "@/lib/stage/layout";
import { mergeStageDesignPlan } from "@/lib/stage/reconcile";
import { emptyStageState, type StageWidget } from "@/lib/stage/schema";

const id = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";
const note: StageWidget = {
  id,
  kind: "note",
  title: "Research",
  text: "Before",
  rect: { x: 0, y: 0, w: 7, h: 6 },
};
const plan: DesignPlan = {
  operations: [
    {
      operation: "upsert",
      kind: "note",
      title: "Research",
      targetId: id,
      rect: null,
      text: "Designer revision",
      code: null,
      ingredients: null,
      steps: null,
    },
  ],
};

describe("stage design reconciliation", () => {
  test("rejects stale content instead of overwriting a user edit", () => {
    const base = { ...emptyStageState(), widgets: [note] };
    const current = { ...base, widgets: [{ ...note, text: "User edit" }] };
    expect(() => mergeStageDesignPlan(current, base, plan, new Map())).toThrow(StageLayoutError);
    expect(current.widgets[0]).toMatchObject({ text: "User edit" });
  });

  test("updates unchanged content while preserving the widget ID and position", () => {
    const base = { ...emptyStageState(), widgets: [note] };
    expect(mergeStageDesignPlan(base, base, plan, new Map())).toEqual([
      { ...note, text: "Designer revision" },
    ]);
  });

  test("honors an explicitly requested 6 by 20 chat and its stable server IDs", () => {
    const base = emptyStageState();
    const rect = { x: 0, y: 0, w: 6, h: 20 };
    const chat: DesignPlan = {
      operations: [
        { ...plan.operations[0], operation: "upsert", kind: "chat", targetId: null, rect },
      ],
    };
    const widgets = mergeStageDesignPlan(
      base,
      base,
      chat,
      new Map([[0, threadId]]),
      new Map([[0, id]])
    );
    expect(widgets).toEqual([{ id, title: "Research", kind: "chat", rect, threadId }]);
  });

  test("moves a live chat without changing its thread, then supports explicit removal", () => {
    const chat: StageWidget = {
      id,
      kind: "chat",
      title: "Chat",
      threadId,
      rect: { x: 0, y: 0, w: 6, h: 20 },
    };
    const base = { ...emptyStageState(), widgets: [chat] };
    const rect = { x: 25, y: 1, w: 6, h: 20 };
    const moved = mergeStageDesignPlan(
      base,
      base,
      { operations: [{ operation: "move", targetId: id, rect }] },
      new Map()
    );
    expect(moved).toEqual([{ ...chat, rect }]);
    expect(
      mergeStageDesignPlan(
        base,
        base,
        { operations: [{ operation: "remove", targetId: id }] },
        new Map()
      )
    ).toEqual([]);
  });

  test("retains unrelated user widgets and rejects collisions with them", () => {
    const base = emptyStageState();
    const current = { ...base, widgets: [note] };
    const colliding: DesignPlan = {
      operations: [
        {
          ...plan.operations[0],
          operation: "upsert",
          kind: "note",
          targetId: null,
          rect: note.rect,
        },
      ],
    };
    expect(() => mergeStageDesignPlan(current, base, colliding, new Map())).toThrow(
      StageLayoutError
    );
    expect(mergeStageDesignPlan(current, base, { operations: [] }, new Map())).toEqual([note]);
  });
});
