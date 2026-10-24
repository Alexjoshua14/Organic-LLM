"use server";

import { AIJobCreate, AIJobInsert, AIJobPatch, AIJobUpdate } from "@/lib/schemas/ai-jobs";

export type { AIJobInsert };
import { supabaseServer } from "@/lib/supabase/server";

import { randomUUID } from "crypto";

/**
 * Create a new AI job in the queue
 */
export async function createAIJob(input: AIJobInsert) {
  const supabase = await supabaseServer();
  const payload = AIJobCreate.parse(input);

  // owner_id is set automatically via current_profile_id() function in DB
  const { data, error } = await supabase
    .from("ai_jobs")
    .insert({
      id: randomUUID(),
      function: payload.function,
      parameters: payload.parameters ?? {},
      priority: payload.priority ?? 3,
      status: "pending",
      metadata: payload.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

/**
 * Update an AI job
 */
export async function updateAIJob(id: string, patch: AIJobPatch) {
  const supabase = await supabaseServer();
  const payload = AIJobUpdate.parse(patch);

  const { data, error } = await supabase
    .from("ai_jobs")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

/**
 * Get a job by ID
 */
export async function getAIJob(id: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("ai_jobs").select("*").eq("id", id).single();

  if (error) throw new Error(error.message);

  return data;
}

/**
 * List jobs for the current user
 */
export async function listAIJobs(limit = 50) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("ai_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return data ?? [];
}
