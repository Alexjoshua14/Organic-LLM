import { z } from "zod";

import { KanbanPrioritySchema, KanbanStatusSchema } from "./item";
import { KANBAN_CAPS, KANBAN_VIEW_INTENTS, KANBAN_VIEW_SORTS } from "./shared";

export const KanbanViewIntentSchema = z.enum(KANBAN_VIEW_INTENTS);
export const KanbanViewSortSchema = z.enum(KANBAN_VIEW_SORTS);

/** Declarative filter the client applies against the board state. */
export const KanbanViewFilterSchema = z.object({
  statuses: z.array(KanbanStatusSchema).max(6).optional(),
  priorities: z.array(KanbanPrioritySchema).max(4).optional(),
  tags: z.array(z.string().min(1).max(KANBAN_CAPS.tag)).max(KANBAN_CAPS.tags).optional(),
  search: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(KANBAN_CAPS.viewLimit).optional(),
  sort: KanbanViewSortSchema.optional(),
});

export type KanbanViewFilter = z.infer<typeof KanbanViewFilterSchema>;

/**
 * A saved view the LLM summons. The view is a *recipe* (filter + intent), not a
 * data snapshot — the client renders it against the current client-side board.
 */
export const KanbanViewSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(KANBAN_CAPS.viewTitle),
  intent: KanbanViewIntentSchema,
  summary: z.string().max(KANBAN_CAPS.viewSummary).optional(),
  filter: KanbanViewFilterSchema.optional(),
  /** How to group columns when rendered. Defaults to "status". */
  groupBy: z.enum(["status", "priority", "none"]).optional(),
});

export type KanbanView = z.infer<typeof KanbanViewSchema>;
