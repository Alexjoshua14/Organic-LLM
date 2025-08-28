import z from "zod";

export const TaskCreate = z.object({
  title: z.string().min(2).max(140),
  notes: z.string().max(10_000).optional(),
  tags: z.array(z.string().min(1).max(24)).max(6).default([]),
  due_date: z.iso.date().optional(), // ISO string
  priority: z.number().int().min(1).max(3).default(2),
});

export const TaskUpdate = TaskCreate.partial();

export type TaskInsert = z.infer<typeof TaskCreate>;
export type TaskPatch = z.infer<typeof TaskUpdate>;
