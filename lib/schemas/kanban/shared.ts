import { z } from "zod";

/** Schema version for all Ergon kanban commands (bump when breaking). */
export const KANBAN_VERSION = z.literal(1);

/** Board columns, ordered backlog -> done. */
export const KANBAN_STATUSES = [
  "backlog",
  "todo",
  "active",
  "in_review",
  "blocked",
  "done",
] as const;

export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

/** Display labels for each status column. */
export const KANBAN_STATUS_LABELS: Record<KanbanStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  active: "Active",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
};

export const KANBAN_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];

/**
 * Puppet command discriminators. Kept as a fast, flat enum so the client listener
 * can switch on `command.type` without parsing the full payload first.
 */
export const KANBAN_COMMAND_TYPES = [
  "INITIATE_KANBAN",
  "UPSERT_ITEMS",
  "UPDATE_ITEM",
  "MOVE_ITEM",
  "REMOVE_ITEM",
  "SHOW_VIEW",
] as const;

export type KanbanCommandType = (typeof KANBAN_COMMAND_TYPES)[number];

/** Saved-view intents the LLM can summon in response to a directive. */
export const KANBAN_VIEW_INTENTS = [
  "board",
  "next-up",
  "active",
  "completed",
  "backlog",
  "review",
  "iteration",
] as const;

export type KanbanViewIntent = (typeof KANBAN_VIEW_INTENTS)[number];

export const KANBAN_VIEW_SORTS = ["priority", "progress", "status", "recent", "manual"] as const;

export type KanbanViewSort = (typeof KANBAN_VIEW_SORTS)[number];

/** Size caps — keep streamed payloads bounded. */
export const KANBAN_CAPS = {
  boardTitle: 120,
  boardDescription: 400,
  itemTitle: 200,
  itemNotes: 1000,
  tag: 40,
  tags: 8,
  itemsPerUpsert: 50,
  seedItems: 50,
  viewTitle: 120,
  viewSummary: 600,
  viewLimit: 50,
} as const;

export function isKanbanCommandType(value: string): value is KanbanCommandType {
  return (KANBAN_COMMAND_TYPES as readonly string[]).includes(value);
}
