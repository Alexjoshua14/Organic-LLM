import type { ManageTasksDeps } from "@/lib/llm/ergon-tasks-execute";
import type { TaskWithCategory } from "@/lib/ergon/types";

import { tool } from "ai";

import { resolveOrCreateCategoryByName } from "@/data/supabase/task-categories";
import { createTask, listTasks, updateTask } from "@/data/supabase/tasks";
import { executeManageTasks } from "@/lib/llm/ergon-tasks-execute";
import { createLogger } from "@/lib/logger";
import { ManageTasksInputSchema } from "@/lib/schemas/ergon-tasks";

export { MANAGE_TASKS_TOOL_NAME } from "@/lib/schemas/ergon-tasks";

const logger = createLogger("lib/llm/ergon-tasks-tool.ts");

const realDeps: ManageTasksDeps = {
  createTask: async (input) => (await createTask(input)) as unknown as TaskWithCategory,
  updateTask: async (id, patch) => (await updateTask(id, patch)) as unknown as TaskWithCategory,
  completeTask: async (id) =>
    (await updateTask(id, {
      status: "done",
      completed_at: new Date().toISOString(),
    })) as unknown as TaskWithCategory,
  listTasks: async () => (await listTasks()) as unknown as TaskWithCategory[],
  resolveOrCreateCategoryByName: async (name) => {
    const category = await resolveOrCreateCategoryByName(name);

    return { id: category.id, name: category.name };
  },
};

/**
 * Aion durable-todo tool. Runs server-side via the Ergon data layer (RLS-scoped to the
 * current user) so edits are shared with the `/ergon` page. Category is passed by name.
 */
export function createManageTasksTool(deps: ManageTasksDeps = realDeps) {
  return tool({
    description:
      "Manage the user's durable Ergon todo list: CREATE_TASKS, UPDATE_TASK, COMPLETE_TASK, or LIST_TASKS. Persists to the database and is shared with the /ergon page. Pass categories by name (resolved or created). Only set fields the user explicitly provided; never invent dates, durations, priority, or effort.",
    inputSchema: ManageTasksInputSchema,
    execute: async (input) => {
      const result = await executeManageTasks(input, deps);

      logger.log("manage_tasks", "executed", {
        command: input.command,
        action: result.action,
        count: result.count ?? result.tasks.length,
        error: result.error,
      });

      return result;
    },
  });
}
