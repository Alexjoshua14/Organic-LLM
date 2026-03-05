"use server";
import { auth } from "@clerk/nextjs/server";
import { supabaseServer } from "@/lib/supabase/server";
import { Result } from "@/types";
import { Profile, ProfileSchema } from "@/lib/schemas/profiles";

/**
 * Retrieves a profile from Supabase by Clerk user ID
 * @param clerkUserId
 * @returns
 */
export async function getProfile(
  clerkUserId: string,
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
  clerkUserId: string,
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

/**
 * Whether the given user should see the sandbox gateway (admin-only entry).
 * Defaults to true until the profiles.admin column exists; once it exists, respects profile.admin.
 * Cached per user on the client — call from a server action for the current user.
 */
export async function getShowSandboxGateway(
  clerkUserId: string,
): Promise<boolean> {
  const result = await getProfile(clerkUserId);
  if (result.error || !result.data) return true;
  return result.data.admin !== false;
}

/**
 * Server action: whether the signed-in user should see the sandbox gateway.
 * Use from the client and cache the result per userId.
 */
export async function getShowSandboxGatewayForCurrentUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  return getShowSandboxGateway(userId);
}
