import { supabaseServer } from "@/lib/supabase/server";
import { Result } from "@/types";
import { Profile, ProfileSchema } from "@/lib/schemas/profiles";

/**
 * Retrieves a profile from Supabase by Clerk user ID
 * @param clerkUserId
 * @returns
 */
export async function getProfile(
  clerkUserId: string
): Promise<Result<Profile>> {
  const sb = await supabaseServer();
  const res = await sb
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (res.error) {
    return {
      data: null,
      error: new Error(res.error?.message ?? "Unknown error"),
    };
  }
  try {
    const profile = ProfileSchema.parse(res.data);
    return {
      data: profile,
      error: null,
    };
  } catch (error: any) {
    return {
      data: null,
      error: new Error(error?.message ?? "Unknown error"),
    };
  }
}

/**
 * Retrieves a user's supabase ID from Supabase by Clerk user ID
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
