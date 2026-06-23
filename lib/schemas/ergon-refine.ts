import z from "zod";

import { MentalEffort, TaskPriority } from "@/lib/schemas/tasks";

export const ErgonRefineCategoryHintSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(64),
});

export const ErgonRefineRequestSchema = z.object({
  titles: z.array(z.string().min(2).max(140)).min(1).max(50),
  categories: z.array(ErgonRefineCategoryHintSchema).max(40),
  /** ISO datetime anchor for relative date parsing on the server. */
  nowIso: z.iso.datetime().optional(),
});

export const ErgonRefineLlmTaskSchema = z.object({
  title: z.string().min(2).max(140),
  category_name: z.string().max(64).nullable().optional(),
  priority: TaskPriority.nullable().optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  planned_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  est_minutes: z.number().int().min(1).max(24 * 60).nullable().optional(),
  mental_effort: MentalEffort.nullable().optional(),
});

export const ErgonRefineLlmOutputSchema = z.object({
  tasks: z.array(ErgonRefineLlmTaskSchema),
});

export type ErgonRefineRequest = z.infer<typeof ErgonRefineRequestSchema>;
export type ErgonRefineLlmTask = z.infer<typeof ErgonRefineLlmTaskSchema>;
