import type { TaskWithCategory } from "@/lib/ergon/types";
import type { TaskInsert } from "@/lib/schemas/tasks";

/** Map a task row back to an insert payload (e.g. to restore a task after an undo). */
export function taskToInsert(task: TaskWithCategory): TaskInsert {
  return {
    title: task.title,
    notes: task.notes ?? undefined,
    tags: task.tags ?? [],
    due_date: task.due_date ?? undefined,
    priority: task.priority as TaskInsert["priority"],
    status: (task.status as TaskInsert["status"]) ?? "todo",
    category_id: task.category_id ?? undefined,
    planned_at: task.planned_at ?? undefined,
    planned_has_time: task.planned_has_time ?? false,
    est_minutes: task.est_minutes ?? undefined,
    mental_effort: (task.mental_effort as TaskInsert["mental_effort"]) ?? undefined,
    is_active: task.is_active ?? false,
  };
}
