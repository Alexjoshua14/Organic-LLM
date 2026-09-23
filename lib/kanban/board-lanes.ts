import type { StoredKanbanItem } from "./store";

import {
  KANBAN_STATUS_LABELS,
  KANBAN_STATUSES,
  type KanbanCommand,
  type KanbanPriority,
  type KanbanStatus,
  type KanbanView,
} from "@/lib/schemas/kanban";

export type KanbanLane = {
  key: string;
  label: string;
  /** Label that fits a collapsed rail. */
  shortLabel: string;
  /** Set when lanes are grouped by status. */
  status?: KanbanStatus;
  items: StoredKanbanItem[];
};

export const KANBAN_STATUS_SHORT_LABELS: Record<KanbanStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  active: "Active",
  in_review: "Review",
  blocked: "Blocked",
  done: "Done",
};

const PRIORITY_LANE_ORDER: KanbanPriority[] = ["urgent", "high", "medium", "low"];

const PRIORITY_LANE_LABELS: Record<KanbanPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_RANK: Record<KanbanPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Stuck first, then moving, then next — done work last. */
const ATTENTION_RANK: Record<KanbanStatus, number> = {
  blocked: 0,
  active: 1,
  in_review: 2,
  todo: 3,
  backlog: 4,
  done: 5,
};

/**
 * Lanes for a stable board skeleton: every status in the view's scope, in workflow order,
 * including empty ones, so lanes never appear or vanish as cards move.
 */
export function buildBoardLanes(items: StoredKanbanItem[], view: KanbanView): KanbanLane[] {
  const groupBy = view.groupBy ?? "status";

  if (groupBy === "none") {
    return [{ key: "all", label: view.title, shortLabel: view.title, items }];
  }

  if (groupBy === "priority") {
    return PRIORITY_LANE_ORDER.map((priority) => ({
      key: priority,
      label: PRIORITY_LANE_LABELS[priority],
      shortLabel: PRIORITY_LANE_LABELS[priority],
      items: items.filter((item) => item.priority === priority),
    }));
  }

  const scope = view.filter?.statuses;
  const statuses =
    scope && scope.length > 0 ? KANBAN_STATUSES.filter((s) => scope.includes(s)) : KANBAN_STATUSES;

  return statuses.map((status) => ({
    key: status,
    label: KANBAN_STATUS_LABELS[status],
    shortLabel: KANBAN_STATUS_SHORT_LABELS[status],
    status,
    items: items.filter((item) => item.status === status),
  }));
}

function compareAttention(a: StoredKanbanItem, b: StoredKanbanItem): number {
  return (
    ATTENTION_RANK[a.status] - ATTENTION_RANK[b.status] ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    b.updatedAt - a.updatedAt
  );
}

/**
 * Cards worth surfacing when a view is summarized inside a message. The unfiltered board is
 * ranked by what needs attention; any other view keeps its own ranking.
 */
export function selectSpotlightItems(
  items: StoredKanbanItem[],
  view: KanbanView,
  limit = 3
): StoredKanbanItem[] {
  const isWholeBoard = view.intent === "board" && !view.filter;
  const ranked = isWholeBoard ? [...items].sort(compareAttention) : items;

  return ranked.slice(0, limit);
}

/** Cards per status, every status present. */
export function countStatuses(items: Iterable<StoredKanbanItem>): Record<KanbanStatus, number> {
  const counts = Object.fromEntries(KANBAN_STATUSES.map((status) => [status, 0])) as Record<
    KanbanStatus,
    number
  >;

  for (const item of items) counts[item.status] += 1;

  return counts;
}

/** Item ids a command touches, in payload order. */
export function kanbanCommandTargets(command: KanbanCommand): string[] {
  switch (command.type) {
    case "INITIATE_KANBAN":
      return (command.seedItems ?? []).map((item) => item.id);
    case "UPSERT_ITEMS":
      return command.items.map((item) => item.id);
    case "UPDATE_ITEM":
    case "MOVE_ITEM":
    case "REMOVE_ITEM":
      return [command.id];
    case "SHOW_VIEW":
      return [];
  }
}

export type KanbanBoardDiff = {
  /** Items whose update marker advanced, plus items that are new. */
  changed: string[];
  /** Status lanes that gained at least one card, in workflow order. */
  gainedLanes: KanbanStatus[];
};

/** Compare two snapshots of a board's items. */
export function diffBoardItems(
  prev: Readonly<Record<string, StoredKanbanItem>>,
  next: Readonly<Record<string, StoredKanbanItem>>
): KanbanBoardDiff {
  const changed: string[] = [];
  const gained = new Set<KanbanStatus>();

  for (const [id, item] of Object.entries(next)) {
    const before = prev[id];

    if (!before) {
      changed.push(id);
      gained.add(item.status);
      continue;
    }

    if (item.updatedAt !== before.updatedAt) changed.push(id);
    if (item.status !== before.status) gained.add(item.status);
  }

  return { changed, gainedLanes: KANBAN_STATUSES.filter((status) => gained.has(status)) };
}
