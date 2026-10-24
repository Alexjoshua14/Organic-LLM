import type { KanbanBoardState, StoredKanbanItem } from "./store";

import {
  KANBAN_STATUS_LABELS,
  KANBAN_STATUSES,
  type KanbanPriority,
  type KanbanStatus,
  type KanbanView,
} from "@/lib/schemas/kanban";

const PRIORITY_RANK: Record<KanbanPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_RANK: Record<KanbanStatus, number> = KANBAN_STATUSES.reduce(
  (acc, status, index) => {
    acc[status] = index;

    return acc;
  },
  {} as Record<KanbanStatus, number>
);

function matchesFilter(item: StoredKanbanItem, view: KanbanView): boolean {
  const f = view.filter;

  if (!f) return true;
  if (f.statuses && f.statuses.length > 0 && !f.statuses.includes(item.status)) return false;
  if (f.priorities && f.priorities.length > 0 && !f.priorities.includes(item.priority)) {
    return false;
  }
  if (f.tags && f.tags.length > 0) {
    const itemTags = item.tags ?? [];

    if (!f.tags.some((t) => itemTags.includes(t))) return false;
  }
  if (f.search && f.search.trim().length > 0) {
    const q = f.search.trim().toLowerCase();
    const haystack = `${item.title} ${item.notes ?? ""}`.toLowerCase();

    if (!haystack.includes(q)) return false;
  }

  return true;
}

function compareItems(a: StoredKanbanItem, b: StoredKanbanItem, view: KanbanView): number {
  const sort = view.filter?.sort ?? "priority";

  switch (sort) {
    case "priority":
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.progress - a.progress;
    case "progress":
      return b.progress - a.progress;
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "recent":
      return b.updatedAt - a.updatedAt;
    case "manual":
      return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
  }
}

/** Apply a view's filter + sort against the board, returning the matching items. */
export function selectViewItems(board: KanbanBoardState, view: KanbanView): StoredKanbanItem[] {
  const items = board.order
    .map((id) => board.items[id])
    .filter((item): item is StoredKanbanItem => Boolean(item) && matchesFilter(item, view));

  items.sort((a, b) => compareItems(a, b, view));

  const limit = view.filter?.limit;

  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export type KanbanColumnGroup = {
  key: string;
  label: string;
  items: StoredKanbanItem[];
};

const PRIORITY_LABELS: Record<KanbanPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Group selected items into columns per the view's `groupBy` (default "status"). */
export function groupViewItems(items: StoredKanbanItem[], view: KanbanView): KanbanColumnGroup[] {
  const groupBy = view.groupBy ?? "status";

  if (groupBy === "none") {
    return [{ key: "all", label: view.title, items }];
  }

  if (groupBy === "priority") {
    const order: KanbanPriority[] = ["urgent", "high", "medium", "low"];

    return order
      .map((priority) => ({
        key: priority,
        label: PRIORITY_LABELS[priority],
        items: items.filter((i) => i.priority === priority),
      }))
      .filter((group) => group.items.length > 0);
  }

  return KANBAN_STATUSES.map((status) => ({
    key: status,
    label: KANBAN_STATUS_LABELS[status],
    items: items.filter((i) => i.status === status),
  })).filter((group) => group.items.length > 0);
}
