"use server";

import type { TaskInsert, TaskPatch } from "@/lib/schemas/tasks";

import { revalidateTag } from "next/cache";

import {
  createTask,
  deleteTask,
  listTasks,
  toggleTaskComplete,
  toggleTaskActive,
  updateTask,
} from "@/data/supabase/tasks";
import { TaskPriority, TaskStatus } from "@/lib/schemas/tasks";

function revalidateTasks() {
  revalidateTag("tasks", "max");
}

export async function actionCreateTask(formData: FormData) {
  const title = String(formData.get("title") || "");
  const notes = formData.get("notes") ? String(formData.get("notes")) : undefined;
  const due = formData.get("due_date") ? String(formData.get("due_date")) : undefined;
  const priorityRaw = formData.get("priority");
  const priority = priorityRaw ? TaskPriority.parse(String(priorityRaw)) : undefined;
  const status = TaskStatus.parse(String(formData.get("status") || "todo"));
  const row = await createTask({
    title,
    notes,
    due_date: due,
    priority,
    tags: [],
    status,
  });

  revalidateTasks();

  return row;
}

export async function actionListTasks() {
  return listTasks();
}

export async function actionAddTask(input: TaskInsert) {
  const row = await createTask(input);

  revalidateTasks();

  return row;
}

export async function actionUpdateTask(id: string, patch: TaskPatch) {
  const row = await updateTask(id, patch);

  revalidateTasks();

  return row;
}

export async function actionToggleTaskComplete(id: string) {
  const row = await toggleTaskComplete(id);

  revalidateTasks();

  return row;
}

export async function actionToggleTaskActive(id: string) {
  const row = await toggleTaskActive(id);

  revalidateTasks();

  return row;
}

export async function actionDeleteTask(id: string) {
  await deleteTask(id);
  revalidateTasks();

  return { ok: true as const };
}
