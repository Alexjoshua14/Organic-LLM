import z from "zod";

import { MentalEffort, TaskPriority, TaskStatus } from "@/lib/schemas/tasks";

/** Aion durable-todo tool name (client-safe constant). */
export const MANAGE_TASKS_TOOL_NAME = "manage_tasks";

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an absolute date in YYYY-MM-DD form");

/** A task the model wants to create or fields it wants to change. */
export const ErgonTaskDraftSchema = z.object({
  title: z.string().min(2).max(140).describe("Short imperative task title"),
  notes: z.string().max(10_000).optional().describe("Optional longer description"),
  category_name: z
    .string()
    .max(64)
    .optional()
    .describe("Category by name; resolved or created automatically. Only set if the user named one."),
  priority: TaskPriority.optional().describe("Only set when the user signals urgency"),
  due_date: IsoDate.optional().describe("Hard deadline (YYYY-MM-DD). Only if the user gave one."),
  planned_date: IsoDate.optional().describe(
    "Day the user intends to do it (YYYY-MM-DD). Only if stated."
  ),
  est_minutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .optional()
    .describe("Estimated minutes. Only if the user stated a duration."),
  mental_effort: MentalEffort.optional().describe("Only if the user mentioned effort"),
});

export const ManageTasksInputSchema = z.object({
  command: z
    .enum(["CREATE_TASKS", "UPDATE_TASK", "COMPLETE_TASK", "LIST_TASKS"])
    .describe("Which operation to perform on the durable Ergon todo list"),
  tasks: z
    .array(ErgonTaskDraftSchema)
    .min(1)
    .max(20)
    .optional()
    .describe("CREATE_TASKS: one or more tasks to create"),
  task_id: z
    .string()
    .uuid()
    .optional()
    .describe("UPDATE_TASK / COMPLETE_TASK: the target task id (use LIST_TASKS to find it)"),
  patch: ErgonTaskDraftSchema.partial()
    .optional()
    .describe("UPDATE_TASK: only the fields to change"),
  filter: z
    .object({
      status: TaskStatus.optional(),
      category_name: z.string().max(64).optional(),
      search: z.string().max(140).optional(),
    })
    .optional()
    .describe("LIST_TASKS: optional filters"),
});

export type ManageTasksInput = z.infer<typeof ManageTasksInputSchema>;

export const ErgonTaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string().nullable(),
  due_date: z.string().nullable(),
  planned_at: z.string().nullable(),
  category_name: z.string().nullable(),
  is_active: z.boolean(),
});

export type ErgonTaskSummary = z.infer<typeof ErgonTaskSummarySchema>;

export const ErgonTasksToolOutputSchema = z.object({
  kind: z.literal("ergon-tasks"),
  action: z.enum(["created", "updated", "completed", "listed", "error"]),
  tasks: z.array(ErgonTaskSummarySchema),
  count: z.number().int().optional(),
  error: z.string().optional(),
});

export type ErgonTasksToolOutput = z.infer<typeof ErgonTasksToolOutputSchema>;
