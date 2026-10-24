"use server";

import { IdeaCreate, IdeaUpdate, IdeaInsert, IdeaPatch } from "@/lib/schemas/ideas";
import { supabaseServer } from "@/lib/supabase/server";

// Create
export async function createIdea(input: IdeaInsert) {
  const supabase = await supabaseServer();
  const payload = IdeaCreate.parse(input);

  // owner_id default is set in DB via public.current_profile_id(), but we can omit it
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      title: payload.title,
      notes: payload.notes ?? null,
      summary: payload.summary ?? null,
      tags: payload.tags ?? [],
      priority: payload.priority ?? 2,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

// List (latest first)
export async function listIdeas() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

// Update (RLS ensures ownership)
export async function updateIdea(id: string, patch: IdeaPatch) {
  const supabase = await supabaseServer();
  const payload = IdeaUpdate.parse(patch);

  const { data, error } = await supabase
    .from("ideas")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

// Delete
export async function deleteIdea(id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("ideas").delete().eq("id", id);

  if (error) throw new Error(error.message);

  return { ok: true };
}
