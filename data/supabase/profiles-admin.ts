import "server-only";

import { Result } from "@/types";
import { cachedProfileId } from "@/lib/supabase/profile-id-cache";
import { supabaseAdmin } from "@/lib/supabase/supabase-admin";

/**
 * Same as getSupabaseUserId but uses the admin client. Use when the user JWT may be expired
 * (e.g. in onFinish after a long stream) to verify the current user's Supabase id.
 */
export async function getSupabaseUserIdWithAdmin(clerkUserId: string): Promise<Result<string>> {
  // Same mapping as getSupabaseUserId, so the same cache.
  return cachedProfileId(clerkUserId, async () => {
    const { data, error } = await supabaseAdmin
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
  });
}
