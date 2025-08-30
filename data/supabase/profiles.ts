import { supabaseServer } from "@/lib/supabase/server";
import { Result } from "@/types";
import { Profile } from "@/lib/schemas/profiles";

export async function getProfile(
  clerkUserId: string
): Promise<Result<Profile>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (error) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }
  return data;
}

/**
 *
 * @param clerkUserId
 * @returns User's supabase ID
 */
export async function getSupabaseUserId(
  clerkUserId: string
): Promise<Result<string>> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (error) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }

  return {
    data: data.id,
    error: null,
  };
}
