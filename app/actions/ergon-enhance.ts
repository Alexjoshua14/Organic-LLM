"use server";

import type { TaskWithCategory } from "@/lib/ergon/types";
import type { TaskPatch } from "@/lib/schemas/tasks";

import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { listCategories } from "@/data/supabase/task-categories";
import { listTasks } from "@/data/supabase/tasks";
import { mergeEnhancement } from "@/lib/ergon/enhance-merge";
import { enhanceTaskFields } from "@/lib/llm/enhance-task";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { searchMemoriesForUser } from "@/lib/memory/operations";

const MAX_CONTEXT_TASKS = 30;
const MAX_MEMORY_SNIPPETS = 5;

function emptyFieldsFor(task: TaskWithCategory): string[] {
  const fields: string[] = [];

  if (!task.category_id) fields.push("category");
  if (!task.priority) fields.push("priority");
  if (task.est_minutes == null) fields.push("est_minutes");
  if (!task.mental_effort) fields.push("mental_effort");
  if (!task.planned_at) fields.push("planned_date");
  if (!task.due_date) fields.push("due_date");

  return fields;
}

/** Best-effort memory lookup; never blocks enhancement if memory is unavailable. */
async function loadMemory(sbUserId: string, query: string): Promise<string[]> {
  try {
    const result = await searchMemoriesForUser(sbUserId, query);

    if (result.error || !result.data?.results) return [];

    return result.data.results
      .map((item) => item.memory)
      .filter((memory): memory is string => typeof memory === "string" && memory.length > 0)
      .slice(0, MAX_MEMORY_SNIPPETS);
  } catch {
    return [];
  }
}

/**
 * Infer values for a single task's empty fields using the user's categories, other tasks,
 * and memory. Returns a patch of only-empty-field fills (may be empty). Does not write.
 */
export async function actionEnhanceTask(taskId: string): Promise<TaskPatch> {
  const { userId } = await auth();

  if (!userId) throw new Error("Unauthorized");

  const sbUserResult = await getSupabaseUserId(userId);

  if (sbUserResult.error || sbUserResult.data === null) {
    throw new Error("User not found");
  }

  const limit = await checkLlmMessageLimit(sbUserResult.data);

  if (!limit.success) {
    throw new Error(limit.error ?? "Too many requests");
  }

  const tasks = (await listTasks()) as TaskWithCategory[];
  const task = tasks.find((item) => item.id === taskId);

  if (!task) throw new Error("Task not found");

  const emptyFields = emptyFieldsFor(task);

  if (emptyFields.length === 0) return {};

  const categories = await listCategories();
  const memory = await loadMemory(sbUserResult.data, task.title);

  const result = await enhanceTaskFields({
    task: { title: task.title, notes: task.notes, emptyFields },
    categories: categories.map((category) => category.name),
    otherTasks: tasks
      .filter((item) => item.id !== taskId)
      .slice(0, MAX_CONTEXT_TASKS)
      .map((item) => ({ title: item.title, category: item.category?.name ?? null })),
    memory,
    now: new Date(),
  });

  if (result.error || !result.data) return {};

  return mergeEnhancement(
    task,
    result.data,
    categories.map((category) => ({ id: category.id, name: category.name }))
  );
}
