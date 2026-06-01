"use client";

import type { KanbanCommand, KanbanItem } from "@/lib/schemas/kanban";

import { createPersistentStore } from "@/lib/client-store/persistent-store";

/** Item as held in the store: schema item plus a monotonic update marker for "recent" sorts. */
export type StoredKanbanItem = KanbanItem & { updatedAt: number };

export type KanbanBoardMeta = {
  id: string;
  title: string;
  description?: string;
};

export type KanbanBoardStatus = "initializing" | "ready";

export type KanbanBoardState = {
  meta: KanbanBoardMeta;
  items: Record<string, StoredKanbanItem>;
  /** Insertion order of item ids (for manual/default display). */
  order: string[];
  status: KanbanBoardStatus;
  /** Id of the most recently summoned view. */
  activeViewId?: string;
  /** Monotonic counter used to stamp item updates. */
  tick: number;
};

export type KanbanStoreState = {
  boards: Record<string, KanbanBoardState>;
};

const store = createPersistentStore<KanbanStoreState>("organic-llm.kanban.v1", {
  boards: {},
});

function createBoard(meta: KanbanBoardMeta): KanbanBoardState {
  return {
    meta,
    items: {},
    order: [],
    status: "initializing",
    tick: 0,
  };
}

function upsertItem(board: KanbanBoardState, item: KanbanItem, tick: number): void {
  const existing = board.items[item.id];

  board.items[item.id] = { ...existing, ...item, updatedAt: tick };
  if (!existing) board.order.push(item.id);
}

/**
 * Pure reducer: apply a single validated command to a board, returning the next board.
 * Exported for unit testing and reuse by a future server-backed store.
 */
export function reduceBoard(
  prev: KanbanBoardState | undefined,
  command: KanbanCommand
): KanbanBoardState {
  switch (command.type) {
    case "INITIATE_KANBAN": {
      const board = createBoard({
        id: command.board.id ?? "board",
        title: command.board.title,
        description: command.board.description,
      });
      const seed = command.seedItems ?? [];

      for (const item of seed) {
        board.tick += 1;
        upsertItem(board, item, board.tick);
      }
      board.status = seed.length > 0 ? "ready" : "initializing";

      return board;
    }

    case "UPSERT_ITEMS": {
      const board: KanbanBoardState = prev
        ? { ...prev, items: { ...prev.items }, order: [...prev.order] }
        : createBoard({ id: "board", title: "Board" });

      for (const item of command.items) {
        board.tick += 1;
        upsertItem(board, item, board.tick);
      }
      board.status = "ready";

      return board;
    }

    case "UPDATE_ITEM": {
      if (!prev || !prev.items[command.id])
        return prev ?? createBoard({ id: "board", title: "Board" });
      const board: KanbanBoardState = { ...prev, items: { ...prev.items }, tick: prev.tick + 1 };

      board.items[command.id] = {
        ...board.items[command.id],
        ...command.patch,
        updatedAt: board.tick,
      };

      return board;
    }

    case "MOVE_ITEM": {
      if (!prev || !prev.items[command.id])
        return prev ?? createBoard({ id: "board", title: "Board" });
      const board: KanbanBoardState = { ...prev, items: { ...prev.items }, tick: prev.tick + 1 };

      board.items[command.id] = {
        ...board.items[command.id],
        status: command.status,
        ...(command.order !== undefined ? { order: command.order } : {}),
        updatedAt: board.tick,
      };

      return board;
    }

    case "REMOVE_ITEM": {
      if (!prev || !prev.items[command.id])
        return prev ?? createBoard({ id: "board", title: "Board" });
      const items = { ...prev.items };

      delete items[command.id];

      return {
        ...prev,
        items,
        order: prev.order.filter((id) => id !== command.id),
      };
    }

    case "SHOW_VIEW": {
      const board: KanbanBoardState = prev ?? createBoard({ id: "board", title: "Board" });

      return { ...board, activeViewId: command.view.id };
    }
  }
}

export function applyKanbanCommand(threadId: string, command: KanbanCommand): void {
  store.setState((prev) => {
    const next = reduceBoard(prev.boards[threadId], command);

    return { boards: { ...prev.boards, [threadId]: next } };
  });
}

export function getKanbanBoard(threadId: string): KanbanBoardState | undefined {
  return store.getState().boards[threadId];
}

export function resetKanbanBoard(threadId: string): void {
  store.setState((prev) => {
    if (!prev.boards[threadId]) return prev;
    const boards = { ...prev.boards };

    delete boards[threadId];

    return { boards };
  });
}

/** React hook: subscribe to a single thread's board. */
export function useKanbanBoard(threadId: string): KanbanBoardState | undefined {
  return store.useStore((s) => s.boards[threadId]);
}

export const __kanbanStoreForTests = store;
