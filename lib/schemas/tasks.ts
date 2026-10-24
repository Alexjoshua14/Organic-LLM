import z from "zod";

export const TaskStatus = z.enum(["todo", "doing", "done", "archived"]);
export const TaskPriority = z.enum(["low", "medium", "high", "urgent"]);
export const MentalEffort = z.enum(["low", "medium", "high"]);

export const TaskCreate = z.object({
  title: z.string().min(2).max(140),
  notes: z.string().max(10_000).optional(),
  tags: z.array(z.string().min(1).max(24)).max(6).default([]),
  due_date: z.iso.date().optional(),
  priority: TaskPriority.nullable().optional(),
  status: TaskStatus.default("todo"),
  category_id: z.uuid().optional(),
  planned_at: z.iso.datetime().optional(),
  planned_has_time: z.boolean().default(false),
  est_minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .optional(),
  mental_effort: MentalEffort.optional(),
  is_active: z.boolean().default(false),
});

// Update allows clearing nullable columns (null) so edits and undo can revert fields.
export const TaskUpdate = z.object({
  title: z.string().min(2).max(140).optional(),
  notes: z.string().max(10_000).nullable().optional(),
  tags: z.array(z.string().min(1).max(24)).max(6).optional(),
  due_date: z.iso.date().nullable().optional(),
  priority: TaskPriority.nullable().optional(),
  status: TaskStatus.optional(),
  category_id: z.uuid().nullable().optional(),
  planned_at: z.iso.datetime().nullable().optional(),
  planned_has_time: z.boolean().optional(),
  est_minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullable()
    .optional(),
  mental_effort: MentalEffort.nullable().optional(),
  is_active: z.boolean().optional(),
  completed_at: z.iso.datetime().nullable().optional(),
});

export type TaskInsert = z.input<typeof TaskCreate>;
export type TaskPatch = z.input<typeof TaskUpdate>;
