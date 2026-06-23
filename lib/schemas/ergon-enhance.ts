import z from "zod";

import { MentalEffort, TaskPriority } from "@/lib/schemas/tasks";

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an absolute date in YYYY-MM-DD form");

/** Fields the model may infer when enriching a single task. All optional/nullable. */
export const ErgonEnhanceFieldsSchema = z.object({
  category_name: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .describe("An existing category name that fits the task, or null"),
  priority: TaskPriority.nullable().optional(),
  due_date: IsoDate.nullable().optional(),
  planned_date: IsoDate.nullable().optional(),
  est_minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullable()
    .optional(),
  mental_effort: MentalEffort.nullable().optional(),
});

export type ErgonEnhanceFields = z.infer<typeof ErgonEnhanceFieldsSchema>;
