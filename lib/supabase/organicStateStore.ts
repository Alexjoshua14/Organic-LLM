"use server";
import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  OrganicState,
  OrganicStateSchema,
  defaultOrganicState,
} from "../schemas/organicStateSchema";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function getState(clerkUserId: string): Promise<OrganicState> {
  const { data, error } = await supabase
    .from("organic_state")
    .select("state")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error && error.code !== "PGRST116") throw error;

  if (!data) {
    const initial = defaultOrganicState();
    const { error: insErr } = await supabase.from("organic_state").insert({
      clerk_user_id: clerkUserId,
      state: initial,
    });
    if (insErr) throw insErr;
    return initial;
  }
  return OrganicStateSchema.parse(data.state);
}

// Use this to get the string so the db content has been parsed and verifed by a single etnry point
export async function getStateString(clerkUserId: string): Promise<string> {
  const state: OrganicState = await getState(clerkUserId);
  return JSON.stringify(state);
}

export async function saveState(
  clerkUserId: string,
  state: OrganicState
): Promise<void> {
  const { error } = await supabase.from("organic_state").upsert({
    clerk_user_id: clerkUserId,
    state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
