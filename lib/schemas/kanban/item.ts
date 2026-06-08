import { z } from "zod";

import { KANBAN_CAPS, KANBAN_PRIORITIES, KANBAN_STATUSES } from "./shared";

export const KanbanStatusSchema = z.enum(KANBAN_STATUSES);
export const KanbanPrioritySchema = z.enum(KANBAN_PRIORITIES);

/** A single tracked work item. Timestamps are filled in by the client store if omitted. */
export const KanbanItemSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(KANBAN_CAPS.itemTitle),
  status: KanbanStatusSchema,
  priority: KanbanPrioritySchema.default("medium"),
  /** Completion percentage 0-100. */
  progress: z.number().int().min(0).max(100).default(0),
  tags: z.array(z.string().min(1).max(KANBAN_CAPS.tag)).max(KANBAN_CAPS.tags).optional(),
  notes: z.string().max(KANBAN_CAPS.itemNotes).optional(),
  /** Manual ordering hint within a column (lower = earlier). */
  order: z.number().optional(),
});

export type KanbanItem = z.infer<typeof KanbanItemSchema>;

/** Partial patch applied to an existing item by id. */
export const KanbanItemPatchSchema = z
  .object({
    title: z.string().min(1).max(KANBAN_CAPS.itemTitle),
    status: KanbanStatusSchema,
    priority: KanbanPrioritySchema,
    progress: z.number().int().min(0).max(100),
    tags: z.array(z.string().min(1).max(KANBAN_CAPS.tag)).max(KANBAN_CAPS.tags),
    notes: z.string().max(KANBAN_CAPS.itemNotes),
    order: z.number(),
  })
  .partial();

export type KanbanItemPatch = z.infer<typeof KanbanItemPatchSchema>;
