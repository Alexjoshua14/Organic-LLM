"use server";

import { revalidateTag } from "next/cache";
import { createTask, updateTask, deleteTask } from "@/data/supabase/tasks";

export async function actionCreateTask(formData: FormData) {
  const title = String(formData.get("title") || "");
  const notes = formData.get("notes")
    ? String(formData.get("notes"))
    : undefined;
  const due = formData.get("due_date")
    ? String(formData.get("due_date"))
    : undefined;
  const priority = Number(formData.get("priority") || 2);

  const row = await createTask({
    title,
    notes,
    due_date: due,
    priority,
    tags: [],
  });
  revalidateTag("tasks"); // if you use fetch caching + tags
  return row;
}

export async function actionUpdateTask(id: string, patch: any) {
  const row = await updateTask(id, patch);
  revalidateTag("tasks");
  return row;
}

export async function actionDeleteTask(id: string) {
  await deleteTask(id);
  revalidateTag("tasks");
}
