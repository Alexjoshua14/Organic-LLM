import type { StoredKanbanItem } from "@/lib/kanban/store";
import type { KanbanView } from "@/lib/schemas/kanban";

import { describe, expect, test } from "bun:test";

import {
  buildBoardLanes,
  countStatuses,
  diffBoardItems,
  kanbanCommandTargets,
  selectSpotlightItems,
} from "@/lib/kanban/board-lanes";
import { KANBAN_STATUSES } from "@/lib/schemas/kanban";

const BOARD_VIEW: KanbanView = { id: "view-board", title: "Full board", intent: "board" };

function item(
  id: string,
  overrides: Partial<StoredKanbanItem> = {}
): StoredKanbanItem {
  return {
    id,
    title: id,
    status: "todo",
    priority: "medium",
    progress: 0,
    updatedAt: 1,
    ...overrides,
  };
}

describe("buildBoardLanes", () => {
  test("keeps every status lane in workflow order, including empty ones", () => {
    const lanes = buildBoardLanes([item("a", { status: "done" })], BOARD_VIEW);

    expect(lanes.map((lane) => lane.status)).toEqual([...KANBAN_STATUSES]);
    expect(lanes.find((lane) => lane.status === "done")?.items).toHaveLength(1);
    expect(lanes.filter((lane) => lane.items.length === 0)).toHaveLength(5);
  });

  test("scopes lanes to the view's status filter", () => {
    const view: KanbanView = {
      ...BOARD_VIEW,
      intent: "active",
      filter: { statuses: ["in_review", "active"] },
    };

    expect(buildBoardLanes([], view).map((lane) => lane.status)).toEqual(["active", "in_review"]);
  });

  test("uses a single lane for ungrouped views", () => {
    const lanes = buildBoardLanes([item("a"), item("b")], { ...BOARD_VIEW, groupBy: "none" });

    expect(lanes).toHaveLength(1);
    expect(lanes[0].items).toHaveLength(2);
  });
});

describe("selectSpotlightItems", () => {
  test("ranks the whole board stuck, then moving, then next", () => {
    const items = [
      item("todo-high", { status: "todo", priority: "high" }),
      item("done", { status: "done", priority: "urgent" }),
      item("active", { status: "active" }),
      item("blocked", { status: "blocked", priority: "low" }),
    ];

    expect(selectSpotlightItems(items, BOARD_VIEW).map((i) => i.id)).toEqual([
      "blocked",
      "active",
      "todo-high",
    ]);
  });

  test("keeps a filtered view's own order", () => {
    const view: KanbanView = { ...BOARD_VIEW, intent: "next-up", filter: { sort: "priority" } };
    const items = [item("first", { status: "todo" }), item("second", { status: "blocked" })];

    expect(selectSpotlightItems(items, view).map((i) => i.id)).toEqual(["first", "second"]);
  });
});

describe("countStatuses", () => {
  test("counts every status, zeros included", () => {
    expect(
      countStatuses([item("a", { status: "todo" }), item("b", { status: "todo" }), item("c", { status: "done" })])
    ).toEqual({ backlog: 0, todo: 2, active: 0, in_review: 0, blocked: 0, done: 1 });
  });
});

describe("kanbanCommandTargets", () => {
  test("returns the ids each command touches", () => {
    expect(
      kanbanCommandTargets({ type: "MOVE_ITEM", version: 1, id: "task-1", status: "done" })
    ).toEqual(["task-1"]);
    expect(
      kanbanCommandTargets({
        type: "UPSERT_ITEMS",
        version: 1,
        items: [item("a"), item("b")],
      })
    ).toEqual(["a", "b"]);
    expect(
      kanbanCommandTargets({
        type: "SHOW_VIEW",
        version: 1,
        view: BOARD_VIEW,
      })
    ).toEqual([]);
  });
});

describe("diffBoardItems", () => {
  test("reports new and updated items and the lanes that gained cards", () => {
    const prev = {
      stay: item("stay", { status: "todo", updatedAt: 1 }),
      move: item("move", { status: "active", updatedAt: 2 }),
    };
    const next = {
      stay: prev.stay,
      move: item("move", { status: "done", updatedAt: 3 }),
      fresh: item("fresh", { status: "backlog", updatedAt: 4 }),
    };

    expect(diffBoardItems(prev, next)).toEqual({
      changed: ["move", "fresh"],
      gainedLanes: ["backlog", "done"],
    });
  });

  test("reports nothing when the snapshot is unchanged", () => {
    const items = { a: item("a") };

    expect(diffBoardItems(items, items)).toEqual({ changed: [], gainedLanes: [] });
  });
});
