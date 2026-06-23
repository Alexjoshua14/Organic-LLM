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

export const TaskUpdate = TaskCreate.partial().extend({
  completed_at: z.iso.datetime().nullable().optional(),
});

export type TaskInsert = z.input<typeof TaskCreate>;
export type TaskPatch = z.input<typeof TaskUpdate>;
