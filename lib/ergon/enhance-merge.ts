import type { ErgonEnhanceFields } from "@/lib/schemas/ergon-enhance";
import type { TaskWithCategory } from "@/lib/ergon/types";
import type { TaskPatch } from "@/lib/schemas/tasks";

import { MentalEffort, TaskPriority } from "@/lib/schemas/tasks";

type EnhanceableTask = Pick<
  TaskWithCategory,
  "category_id" | "priority" | "due_date" | "planned_at" | "est_minutes" | "mental_effort"
>;

function plannedDateToTimestamp(isoDate: string): string {
  return `${isoDate}T12:00:00.000Z`;
}

/**
 * Build a patch that fills ONLY the task's empty fields from the model's suggestions.
 * Never overwrites existing values; category must match an existing category (no invention).
 */
export function mergeEnhancement(
  task: EnhanceableTask,
  suggestion: ErgonEnhanceFields,
  categories: { id: string; name: string }[]
): TaskPatch {
  const patch: TaskPatch = {};

  if (!task.category_id && suggestion.category_name?.trim()) {
    const normalized = suggestion.category_name.trim().toLowerCase();
    const match = categories.find((category) => category.name.trim().toLowerCase() === normalized);

    if (match) patch.category_id = match.id;
  }

  if (!task.priority && suggestion.priority && TaskPriority.safeParse(suggestion.priority).success) {
    patch.priority = suggestion.priority;
  }

  if (task.est_minutes == null && suggestion.est_minutes != null && suggestion.est_minutes >= 1) {
    patch.est_minutes = suggestion.est_minutes;
  }

  if (
    !task.mental_effort &&
    suggestion.mental_effort &&
    MentalEffort.safeParse(suggestion.mental_effort).success
  ) {
    patch.mental_effort = suggestion.mental_effort;
  }

  if (!task.planned_at && suggestion.planned_date) {
    patch.planned_at = plannedDateToTimestamp(suggestion.planned_date);
    patch.planned_has_time = false;
  }

  if (!task.due_date && suggestion.due_date) {
    patch.due_date = suggestion.due_date;
  }

  return patch;
}

const PATCH_LABELS: Record<string, string> = {
  category_id: "category",
  priority: "priority",
  est_minutes: "duration",
  mental_effort: "effort",
  planned_at: "planned date",
  due_date: "due date",
};

/** Human-readable summary of which fields a patch fills (for toasts). */
export function summarizeEnhancement(patch: TaskPatch): string[] {
  return Object.keys(patch)
    .filter((key) => key in PATCH_LABELS)
    .map((key) => PATCH_LABELS[key]!);
}
