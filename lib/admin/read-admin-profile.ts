import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

/** Fresh, minimal profile access data. Never cache authorization decisions across requests. */
export async function readAdminProfile(clerkUserId: string): Promise<{
  id: string;
  admin: boolean;
} | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("admin_access")
    .select("profile_id, profiles!inner(id)")
    .eq("profiles.clerk_user_id", clerkUserId)
    .maybeSingle();

  // Deny access until the membership migration has been applied and exposed by PostgREST.
  if (error?.code === "PGRST205" && error.message.includes("public.admin_access")) {
    return null;
  }
  if (error) throw new Error("Unable to load profile access.");
  if (!data || typeof data.profile_id !== "string" || !data.profile_id) return null;

  return { id: data.profile_id, admin: true };
}

/** Authorization fails closed, including when the profile service is unavailable. */
export async function isAdminUser(clerkUserId: string): Promise<boolean> {
  try {
    return (await readAdminProfile(clerkUserId))?.admin === true;
  } catch {
    return false;
  }
}
