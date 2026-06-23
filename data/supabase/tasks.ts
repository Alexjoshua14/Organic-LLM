"use server";

import { TaskCreate, TaskUpdate, TaskInsert, TaskPatch } from "@/lib/schemas/tasks";
import { supabaseServer } from "@/lib/supabase/server";

const TASK_SELECT = "*, category:task_categories(*)";

function taskInsertRow(payload: ReturnType<typeof TaskCreate.parse>) {
  return {
    title: payload.title,
    notes: payload.notes ?? null,
    tags: payload.tags ?? [],
    due_date: payload.due_date ?? null,
    priority: payload.priority ?? null,
    status: payload.status ?? "todo",
    category_id: payload.category_id ?? null,
    planned_at: payload.planned_at ?? null,
    planned_has_time: payload.planned_has_time ?? false,
    est_minutes: payload.est_minutes ?? null,
    mental_effort: payload.mental_effort ?? null,
    is_active: payload.is_active ?? false,
  };
}

// Create
export async function createTask(input: TaskInsert) {
  const supabase = await supabaseServer();
  const payload = TaskCreate.parse(input);

  const { data, error } = await supabase
    .from("tasks")
    .insert(taskInsertRow(payload))
    .select(TASK_SELECT)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

// List (latest first)
export async function listTasks() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

// Update (RLS ensures ownership)
export async function updateTask(id: string, patch: TaskPatch) {
  const supabase = await supabaseServer();
  const payload = TaskUpdate.parse(patch);

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .select(TASK_SELECT)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

/** Toggle todo ↔ done and stamp or clear completed_at. */
export async function toggleTaskComplete(id: string) {
  const supabase = await supabaseServer();
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const isDone = task.status === "done";

  return updateTask(id, {
    status: isDone ? "todo" : "done",
    completed_at: isDone ? null : new Date().toISOString(),
  });
}

/** Toggle is_active for focus / lumen highlight on the Ergon task row. */
export async function toggleTaskActive(id: string) {
  const supabase = await supabaseServer();
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("is_active")
    .eq("id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  return updateTask(id, { is_active: !task.is_active });
}

// Delete
export async function deleteTask(id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) throw new Error(error.message);

  return { ok: true };
}
