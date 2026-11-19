import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Fresh `lab_access` membership for one account: its profile id, or null without a row. Same
 * shape and rules as `readAdminProfile`. Never cache authorization decisions across requests.
 * A lab row is not admin; admins see labs without one (lib/admin/lab-access.ts).
 */
export async function readLabAccess(clerkUserId: string): Promise<{ id: string } | null> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("lab_access")
    .select("profile_id, profiles!inner(id)")
    .eq("profiles.clerk_user_id", clerkUserId)
    .maybeSingle();

  // Deny access until the membership migration has been applied and exposed by PostgREST.
  if (error?.code === "PGRST205" && error.message.includes("public.lab_access")) {
    return null;
  }
  if (error) throw new Error("Unable to load lab access.");
  if (!data || typeof data.profile_id !== "string" || !data.profile_id) return null;

  return { id: data.profile_id };
}
