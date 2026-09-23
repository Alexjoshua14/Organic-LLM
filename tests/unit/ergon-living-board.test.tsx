import type { KanbanBoardState } from "@/lib/kanban/store";
import type { KanbanCommand } from "@/lib/schemas/kanban";

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";

import { render } from "../helpers/render";

import { KanbanCompact } from "@/app/sandbox/prototypes/ergon/_components/KanbanCompact";
import { LivingBoard } from "@/app/sandbox/prototypes/ergon/_components/LivingBoard";
import { describeKanbanCommand } from "@/app/sandbox/prototypes/ergon/_components/living-light";
import {
  advanceBoardChanges,
  freshStamp,
  NO_BOARD_CHANGES,
} from "@/app/sandbox/prototypes/ergon/_components/use-board-changes";
import { reduceBoard } from "@/lib/kanban/store";
import { KANBAN_STATUSES } from "@/lib/schemas/kanban";
import {
  ERGON_FULL_BOARD_VIEW,
  ERGON_NEXT_UP_VIEW,
  ergonShowcaseCommands,
} from "@/lib/showcase/ergon-session";

const finalBoard = ergonShowcaseCommands.reduce<KanbanBoardState | undefined>(
  reduceBoard,
  undefined
);

const MOVE_SIGNUP_DONE: KanbanCommand = {
  type: "MOVE_ITEM",
  version: 1,
  id: "task-signup-bug",
  status: "done",
};

afterEach(() => cleanup());

function cardIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>("[data-kanban-card]")].map(
    (el) => el.dataset.kanbanCard ?? ""
  );
}

describe("LivingBoard", () => {
  test("keeps all six lanes in workflow order, empty ones included", () => {
    const { container, getByLabelText, getByText } = render(
      <LivingBoard board={finalBoard} light="trace" view={ERGON_FULL_BOARD_VIEW} />
    );
    const lanes = [...container.querySelectorAll<HTMLElement>("[data-kanban-lane]")].map(
      (el) => el.dataset.kanbanLane
    );

    expect(lanes).toEqual([...KANBAN_STATUSES]);
    expect(getByLabelText("To do, 4 cards")).toBeTruthy();
    expect(getByLabelText("Active, 0 cards")).toBeTruthy();
    expect(getByText("Assemble press kit")).toBeTruthy();
  });

  test("renders an ungrouped view as one ranked list", () => {
    const { container } = render(
      <LivingBoard board={finalBoard} light="field" view={ERGON_NEXT_UP_VIEW} />
    );

    expect(cardIds(container)).toEqual(["task-waitlist", "task-press-kit", "task-analytics"]);
  });

  test("presence narrates the command in flight", () => {
    const { getByText } = render(
      <LivingBoard
        activity={{ phase: "working", command: MOVE_SIGNUP_DONE, targetId: "task-signup-bug" }}
        board={finalBoard}
        light="presence"
        view={ERGON_FULL_BOARD_VIEW}
      />
    );

    expect(getByText("“Fix signup redirect bug” → Done")).toBeTruthy();
  });
});

describe("KanbanCompact", () => {
  test("summarizes the whole board and spotlights what needs attention", () => {
    const { container, getByText } = render(
      <KanbanCompact
        board={finalBoard}
        boardView={ERGON_FULL_BOARD_VIEW}
        light="trace"
        view={ERGON_FULL_BOARD_VIEW}
      />
    );

    expect(getByText("+4 more on the board")).toBeTruthy();
    expect(getByText("Rewrite landing hero copy")).toBeTruthy();
    expect(getByText("Send waitlist invite email")).toBeTruthy();
    expect(getByText("Assemble press kit")).toBeTruthy();
    expect(container.querySelector('[aria-label="Cards by status"]')?.textContent).toContain(
      "To do4"
    );
  });
});

describe("advanceBoardChanges", () => {
  const boards = ergonShowcaseCommands.reduce<KanbanBoardState[]>(
    (acc, command) => [...acc, reduceBoard(acc[acc.length - 1], command)],
    []
  );
  const at = (applied: number) => boards[applied - 1]!.items;

  test("marks new cards as added and a lane change as moved", () => {
    const added = advanceBoardChanges(NO_BOARD_CHANGES, at(1), at(2));

    expect(added.stamp).toBe(1);
    expect([...added.added]).toEqual([...added.touched]);
    expect(added.moved.size).toBe(0);
    expect([...added.gainedLanes]).toEqual(["backlog", "todo", "active", "blocked"]);

    const moved = advanceBoardChanges(added, at(5), at(6));

    expect(moved.stamp).toBe(2);
    expect([...moved.touched]).toEqual(["task-signup-bug"]);
    expect([...moved.moved]).toEqual(["task-signup-bug"]);
    expect(moved.added.size).toBe(0);
    expect([...moved.gainedLanes]).toEqual(["done"]);
    expect(freshStamp(moved, "task-signup-bug")).toBe(2);
    expect(freshStamp(moved, "task-landing-copy")).toBeUndefined();
  });

  test("keeps the same record when nothing visible changed", () => {
    const current = advanceBoardChanges(NO_BOARD_CHANGES, at(1), at(2));

    // SHOW_VIEW changes the board but not its cards.
    expect(advanceBoardChanges(current, at(3), at(4))).toBe(current);
  });
});

describe("describeKanbanCommand", () => {
  test("names cards by title", () => {
    expect(describeKanbanCommand(MOVE_SIGNUP_DONE, finalBoard)).toBe(
      "“Fix signup redirect bug” → Done"
    );
    expect(
      describeKanbanCommand(
        {
          type: "UPSERT_ITEMS",
          version: 1,
          items: [
            { id: "a", title: "A", status: "todo", priority: "low", progress: 0 },
            { id: "b", title: "B", status: "todo", priority: "low", progress: 0 },
          ],
        },
        finalBoard
      )
    ).toBe("Adding 2 cards");
    expect(
      describeKanbanCommand(
        {
          type: "UPSERT_ITEMS",
          version: 1,
          items: [{ id: "new", title: "Book venue", status: "todo", priority: "low", progress: 0 }],
        },
        finalBoard
      )
    ).toBe("Adding “Book venue”");
  });
});
