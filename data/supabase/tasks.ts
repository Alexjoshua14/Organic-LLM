"use server";

import {
  TaskCreate,
  TaskUpdate,
  TaskInsert,
  TaskPatch,
} from "@/lib/schemas/tasks";
import { supabaseServer } from "@/lib/supabase/server";

// Create
export async function createTask(input: TaskInsert) {
  const supabase = await supabaseServer();
  const payload = TaskCreate.parse(input);

  // owner_id default is set in DB via public.current_profile_id(), but we can omit it
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: payload.title,
      notes: payload.notes ?? null,
      tags: payload.tags ?? [],
      due_date: payload.due_date ?? null,
      priority: payload.priority ?? 2,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

// List (latest first)
export async function listTasks() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
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
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

// Delete
export async function deleteTask(id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) throw new Error(error.message);

  return { ok: true };
}
