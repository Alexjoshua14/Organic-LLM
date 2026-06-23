import type {
  ErgonTaskSummary,
  ErgonTasksToolOutput,
  ManageTasksInput,
} from "@/lib/schemas/ergon-tasks";
import type { TaskWithCategory } from "@/lib/ergon/types";
import type { TaskInsert, TaskPatch } from "@/lib/schemas/tasks";

type TaskDraft = NonNullable<ManageTasksInput["tasks"]>[number];

/** Data-layer functions the tool needs; injected so the executor stays testable. */
export type ManageTasksDeps = {
  createTask: (input: TaskInsert) => Promise<TaskWithCategory>;
  updateTask: (id: string, patch: TaskPatch) => Promise<TaskWithCategory>;
  completeTask: (id: string) => Promise<TaskWithCategory>;
  listTasks: () => Promise<TaskWithCategory[]>;
  resolveOrCreateCategoryByName: (name: string) => Promise<{ id: string; name: string }>;
};

/** Date-only planned input becomes a noon timestamp with planned_has_time = false. */
function plannedDateToTimestamp(isoDate: string): string {
  return `${isoDate}T12:00:00.000Z`;
}

function toSummary(task: TaskWithCategory): ErgonTaskSummary {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority ?? null,
    due_date: task.due_date ?? null,
    planned_at: task.planned_at ?? null,
    category_name: task.category?.name ?? null,
    is_active: task.is_active === true,
  };
}

async function draftToInsert(draft: TaskDraft, deps: ManageTasksDeps): Promise<TaskInsert> {
  const insert: TaskInsert = { title: draft.title, tags: [] };

  if (draft.notes) insert.notes = draft.notes;
  if (draft.priority) insert.priority = draft.priority;
  if (draft.mental_effort) insert.mental_effort = draft.mental_effort;
  if (draft.est_minutes != null) insert.est_minutes = draft.est_minutes;
  if (draft.due_date) insert.due_date = draft.due_date;

  if (draft.planned_date) {
    insert.planned_at = plannedDateToTimestamp(draft.planned_date);
    insert.planned_has_time = false;
  }

  if (draft.category_name?.trim()) {
    const category = await deps.resolveOrCreateCategoryByName(draft.category_name);

    insert.category_id = category.id;
  }

  return insert;
}

async function draftToPatch(
  draft: Partial<TaskDraft>,
  deps: ManageTasksDeps
): Promise<TaskPatch> {
  const patch: TaskPatch = {};

  if (draft.title) patch.title = draft.title;
  if (draft.notes !== undefined) patch.notes = draft.notes;
  if (draft.priority) patch.priority = draft.priority;
  if (draft.mental_effort) patch.mental_effort = draft.mental_effort;
  if (draft.est_minutes != null) patch.est_minutes = draft.est_minutes;
  if (draft.due_date) patch.due_date = draft.due_date;

  if (draft.planned_date) {
    patch.planned_at = plannedDateToTimestamp(draft.planned_date);
    patch.planned_has_time = false;
  }

  if (draft.category_name?.trim()) {
    const category = await deps.resolveOrCreateCategoryByName(draft.category_name);

    patch.category_id = category.id;
  }

  return patch;
}

function applyFilter(
  tasks: TaskWithCategory[],
  filter: ManageTasksInput["filter"]
): TaskWithCategory[] {
  if (!filter) return tasks;

  const search = filter.search?.trim().toLowerCase();
  const categoryName = filter.category_name?.trim().toLowerCase();

  return tasks.filter((task) => {
    if (filter.status && task.status !== filter.status) return false;

    if (categoryName && (task.category?.name?.toLowerCase() ?? "") !== categoryName) {
      return false;
    }

    if (search) {
      const inTitle = task.title.toLowerCase().includes(search);
      const inNotes = task.notes?.toLowerCase().includes(search) ?? false;

      if (!inTitle && !inNotes) return false;
    }

    return true;
  });
}

function errorOutput(
  action: ErgonTasksToolOutput["action"],
  message: string
): ErgonTasksToolOutput {
  return { kind: "ergon-tasks", action, tasks: [], count: 0, error: message };
}

/**
 * Server-side executor for the Aion `manage_tasks` tool.
 * Pure orchestration over injected data-layer deps; returns a compact, card-renderable result.
 */
export async function executeManageTasks(
  input: ManageTasksInput,
  deps: ManageTasksDeps
): Promise<ErgonTasksToolOutput> {
  try {
    switch (input.command) {
      case "CREATE_TASKS": {
        const drafts = input.tasks ?? [];

        if (drafts.length === 0) {
          return errorOutput("error", "CREATE_TASKS requires at least one task.");
        }

        const created: TaskWithCategory[] = [];

        for (const draft of drafts) {
          const insert = await draftToInsert(draft, deps);

          created.push(await deps.createTask(insert));
        }

        return {
          kind: "ergon-tasks",
          action: "created",
          tasks: created.map(toSummary),
          count: created.length,
        };
      }

      case "UPDATE_TASK": {
        if (!input.task_id) {
          return errorOutput("error", "UPDATE_TASK requires task_id. Use LIST_TASKS to find it.");
        }

        const patch = await draftToPatch(input.patch ?? {}, deps);
        const row = await deps.updateTask(input.task_id, patch);

        return { kind: "ergon-tasks", action: "updated", tasks: [toSummary(row)], count: 1 };
      }

      case "COMPLETE_TASK": {
        if (!input.task_id) {
          return errorOutput("error", "COMPLETE_TASK requires task_id. Use LIST_TASKS to find it.");
        }

        const row = await deps.completeTask(input.task_id);

        return { kind: "ergon-tasks", action: "completed", tasks: [toSummary(row)], count: 1 };
      }

      case "LIST_TASKS": {
        const all = await deps.listTasks();
        const filtered = applyFilter(all, input.filter);

        return {
          kind: "ergon-tasks",
          action: "listed",
          tasks: filtered.map(toSummary),
          count: filtered.length,
        };
      }

      default:
        return errorOutput("error", "Unknown command.");
    }
  } catch (error) {
    return errorOutput(
      input.command === "LIST_TASKS"
        ? "listed"
        : input.command === "CREATE_TASKS"
          ? "created"
          : input.command === "COMPLETE_TASK"
            ? "completed"
            : "updated",
      error instanceof Error ? error.message : "Failed to manage tasks."
    );
  }
}
