"use client";

import type { KanbanBoardState, StoredKanbanItem } from "@/lib/kanban/store";
import type { KanbanStatus } from "@/lib/schemas/kanban";

import { useState } from "react";

import { diffBoardItems } from "@/lib/kanban/board-lanes";

/** What the model's latest change set touched. */
export type BoardChanges = {
  /** Increments with every change set; 0 until the first. */
  stamp: number;
  /** Cards touched, in payload order — where light should aim. */
  touched: ReadonlySet<string>;
  /** Cards that are new to the board. */
  added: ReadonlySet<string>;
  /** Cards that changed lanes. */
  moved: ReadonlySet<string>;
  /** Status lanes that gained a card. */
  gainedLanes: ReadonlySet<KanbanStatus>;
};

type BoardItems = Readonly<Record<string, StoredKanbanItem>>;

const NO_ITEMS: BoardItems = {};

export const NO_BOARD_CHANGES: BoardChanges = {
  stamp: 0,
  touched: new Set(),
  added: new Set(),
  moved: new Set(),
  gainedLanes: new Set(),
};

/** The next change record, or `current` when the new snapshot changes nothing visible. */
export function advanceBoardChanges(
  current: BoardChanges,
  prev: BoardItems,
  next: BoardItems
): BoardChanges {
  const { changed, gainedLanes } = diffBoardItems(prev, next);

  if (changed.length === 0 && gainedLanes.length === 0) return current;

  return {
    stamp: current.stamp + 1,
    touched: new Set(changed),
    added: new Set(changed.filter((id) => !prev[id])),
    moved: new Set(changed.filter((id) => prev[id] && prev[id].status !== next[id]?.status)),
    gainedLanes: new Set(gainedLanes),
  };
}

/** Stamp for light that should play once when this card changes. */
export function freshStamp(changes: BoardChanges, id: string): number | undefined {
  return changes.touched.has(id) ? changes.stamp : undefined;
}

/**
 * Tracks which cards and lanes the model just touched. Derived while rendering, so the commit
 * a change lands in already knows what is new: no follow-up render mid-glide, and no timers —
 * light keyed to the stamp plays once and settles on its own. Diffing happens at board level
 * because a card that changes lanes remounts.
 */
export function useBoardChanges(board: KanbanBoardState | undefined): BoardChanges {
  const items = board?.items ?? NO_ITEMS;
  // First sighting: whatever is already on the board is not news.
  const [tracked, setTracked] = useState({ items, changes: NO_BOARD_CHANGES });

  if (tracked.items !== items) {
    const changes = advanceBoardChanges(tracked.changes, tracked.items, items);

    setTracked({ items, changes });

    return changes;
  }

  return tracked.changes;
}
