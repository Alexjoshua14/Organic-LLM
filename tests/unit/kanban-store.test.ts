import { describe, expect, test } from "bun:test";

import { groupViewItems, selectViewItems } from "@/lib/kanban/select-view";
import { reduceBoard, type KanbanBoardState } from "@/lib/kanban/store";
import type { KanbanCommand } from "@/lib/schemas/kanban";
import {
  FIXTURE_INITIATE,
  FIXTURE_SHOW_ACTIVE_VIEW,
  FIXTURE_SHOW_NEXT_UP_VIEW,
  FIXTURE_UPSERT,
} from "@/lib/schemas/kanban/fixtures";

function hydrated(): KanbanBoardState {
  const initiated = reduceBoard(undefined, FIXTURE_INITIATE);
  return reduceBoard(initiated, FIXTURE_UPSERT);
}

describe("reduceBoard", () => {
  test("INITIATE without seed is initializing", () => {
    const board = reduceBoard(undefined, FIXTURE_INITIATE);
    expect(board.status).toBe("initializing");
    expect(board.meta.title).toBe("Ergon board");
    expect(Object.keys(board.items).length).toBe(0);
  });

  test("UPSERT marks ready and adds items in order", () => {
    const board = hydrated();
    expect(board.status).toBe("ready");
    expect(board.order.length).toBe(FIXTURE_UPSERT.items.length);
    expect(board.items.i1.title).toBe("Define kanban command schema");
  });

  test("UPDATE_ITEM patches an existing item", () => {
    const board = reduceBoard(hydrated(), {
      type: "UPDATE_ITEM",
      version: 1,
      id: "i4",
      patch: { progress: 50, status: "active" },
    });
    expect(board.items.i4.progress).toBe(50);
    expect(board.items.i4.status).toBe("active");
  });

  test("MOVE_ITEM changes status", () => {
    const board = reduceBoard(hydrated(), {
      type: "MOVE_ITEM",
      version: 1,
      id: "i2",
      status: "done",
    });
    expect(board.items.i2.status).toBe("done");
  });

  test("REMOVE_ITEM drops the item and its order entry", () => {
    const board = reduceBoard(hydrated(), { type: "REMOVE_ITEM", version: 1, id: "i1" });
    expect(board.items.i1).toBeUndefined();
    expect(board.order).not.toContain("i1");
  });

  test("SHOW_VIEW records the active view id", () => {
    const board = reduceBoard(hydrated(), FIXTURE_SHOW_ACTIVE_VIEW);
    expect(board.activeViewId).toBe(FIXTURE_SHOW_ACTIVE_VIEW.view.id);
  });

  test("mutation on missing board is a no-op-ish empty board", () => {
    const board = reduceBoard(undefined, {
      type: "UPDATE_ITEM",
      version: 1,
      id: "nope",
      patch: { progress: 10 },
    } satisfies KanbanCommand);
    expect(Object.keys(board.items).length).toBe(0);
  });
});

describe("selectViewItems", () => {
  test("active view filters to active + in_review", () => {
    const items = selectViewItems(hydrated(), FIXTURE_SHOW_ACTIVE_VIEW.view);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.status === "active" || i.status === "in_review")).toBe(true);
  });

  test("next-up view respects limit and todo filter", () => {
    const items = selectViewItems(hydrated(), FIXTURE_SHOW_NEXT_UP_VIEW.view);
    expect(items.every((i) => i.status === "todo")).toBe(true);
    expect(items.length).toBeLessThanOrEqual(5);
  });

  test("priority sort puts urgent before medium", () => {
    const items = selectViewItems(hydrated(), FIXTURE_SHOW_ACTIVE_VIEW.view);
    const urgentIdx = items.findIndex((i) => i.priority === "urgent");
    const mediumIdx = items.findIndex((i) => i.priority === "medium");
    if (urgentIdx !== -1 && mediumIdx !== -1) {
      expect(urgentIdx).toBeLessThan(mediumIdx);
    }
  });
});

describe("groupViewItems", () => {
  test("groups by status by default", () => {
    const board = hydrated();
    const items = selectViewItems(board, FIXTURE_SHOW_ACTIVE_VIEW.view);
    const groups = groupViewItems(items, FIXTURE_SHOW_ACTIVE_VIEW.view);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  test("groupBy none yields a single group", () => {
    const board = hydrated();
    const items = selectViewItems(board, FIXTURE_SHOW_NEXT_UP_VIEW.view);
    const groups = groupViewItems(items, FIXTURE_SHOW_NEXT_UP_VIEW.view);
    expect(groups.length).toBe(1);
  });
});
