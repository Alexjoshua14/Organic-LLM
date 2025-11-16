"use server";

import { revalidateTag } from "next/cache";

import { createTask, updateTask, deleteTask } from "@/data/supabase/tasks";
import { TaskStatus } from "@/lib/schemas/tasks";

export async function actionCreateTask(formData: FormData) {
  const title = String(formData.get("title") || "");
  const notes = formData.get("notes")
    ? String(formData.get("notes"))
    : undefined;
  const due = formData.get("due_date")
    ? String(formData.get("due_date"))
    : undefined;
  const priority = Number(formData.get("priority") || 2);
  const status = TaskStatus.parse(String(formData.get("status") || "todo"));
  const row = await createTask({
    title,
    notes,
    due_date: due,
    priority,
    tags: [],
    status,
  });

  revalidateTag("tasks", "max"); // if you use fetch caching + tags

  return row;
}

export async function actionUpdateTask(id: string, patch: any) {
  const row = await updateTask(id, patch);

  revalidateTag("tasks", "max");

  return row;
}

export async function actionDeleteTask(id: string) {
  await deleteTask(id);
  revalidateTag("tasks", "max");
}
