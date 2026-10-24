import { describe, expect, test } from "bun:test";

import { reduceBoard } from "@/lib/kanban/store";
import { groupViewItems, selectViewItems } from "@/lib/kanban/select-view";
import {
  ERGON_FULL_BOARD_VIEW,
  ERGON_NEXT_UP_VIEW,
  ergonShowcaseCommands,
  ergonShowcaseSession,
} from "@/lib/showcase/ergon-session";
import { KanbanCommandSchema } from "@/lib/schemas/kanban";

describe("showcase ergon session", () => {
  test("every command parses with KanbanCommandSchema", () => {
    for (const command of ergonShowcaseCommands) {
      const parsed = KanbanCommandSchema.safeParse(command);

      expect(parsed.success).toBe(true);
    }
  });

  test("session has three chapters with tool effects", () => {
    expect(ergonShowcaseSession.chapters).toHaveLength(3);
    const toolSteps = ergonShowcaseSession.chapters.flatMap((c) =>
      c.assistant.filter((s) => s.kind === "tool")
    );

    expect(toolSteps.length).toBe(10);
    expect(ergonShowcaseCommands).toHaveLength(10);
  });

  test("full board stays within four columns and later cards land in existing ones", () => {
    let board = undefined as ReturnType<typeof reduceBoard> | undefined;
    let upserts = 0;

    for (const command of ergonShowcaseCommands) {
      if (command.type === "UPSERT_ITEMS") {
        if (upserts > 0 && board) {
          const occupied = new Set(Object.values(board.items).map((i) => i.status));

          for (const item of command.items) {
            expect(occupied.has(item.status)).toBe(true);
          }
        }
        upserts++;
      }

      board = reduceBoard(board, command);
      if (board.status !== "ready") continue;

      const items = selectViewItems(board, ERGON_FULL_BOARD_VIEW);

      expect(groupViewItems(items, ERGON_FULL_BOARD_VIEW).length).toBeLessThanOrEqual(4);
    }
  });

  test("MOVE_ITEM and UPDATE_ITEM target items that exist when applied", () => {
    let board = undefined as ReturnType<typeof reduceBoard> | undefined;

    for (const command of ergonShowcaseCommands) {
      if (command.type === "UPDATE_ITEM" || command.type === "MOVE_ITEM") {
        expect(board?.items[command.id]).toBeTruthy();
      }
      board = reduceBoard(board, command);
    }

    expect(board?.status).toBe("ready");
    expect(board?.items["task-signup-bug"]?.status).toBe("done");
    expect(board?.items["task-waitlist"]?.status).toBe("todo");
    expect(board?.items["task-waitlist"]?.priority).toBe("urgent");
    expect(board?.items["task-press-kit"]).toBeTruthy();
  });

  test("chapter 3 next-up view selects expected items in priority order", () => {
    let board = undefined as ReturnType<typeof reduceBoard> | undefined;

    for (const command of ergonShowcaseCommands) {
      board = reduceBoard(board, command);
    }

    expect(board).toBeTruthy();
    if (!board) return;

    const items = selectViewItems(board, ERGON_NEXT_UP_VIEW);

    expect(items.length).toBeLessThanOrEqual(3);
    expect(items.every((i) => i.status === "todo")).toBe(true);
    expect(items.map((i) => i.id)).toEqual([
      "task-waitlist",
      "task-press-kit",
      "task-analytics",
    ]);
  });
});
