import type { z } from "zod";

import { TaskStatus } from "@/lib/schemas/tasks";

export type TaskStatusValue = z.infer<typeof TaskStatus>;

/** Human-readable labels for task status values stored in the database. */
export const TASK_STATUS_LABELS: Record<TaskStatusValue, string> = {
  todo: "Queued",
  doing: "In progress",
  done: "Complete",
  archived: "Archived",
};

export function formatTaskStatus(status: string): string {
  return TASK_STATUS_LABELS[status as TaskStatusValue] ?? status;
}
