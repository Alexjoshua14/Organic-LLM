import "server-only";

import { auth } from "@clerk/nextjs/server";

import { getShowSandboxGateway, getSupabaseUserId } from "@/data/supabase/profiles";

export type AdminContext = {
  clerkUserId: string;
  sbUserId: string;
};

/**
 * Returns admin context when the signed-in user passes the sandbox/admin gate.
 * Used by `app/admin/*` pages and `/api/admin/*` routes.
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  const isAdmin = await getShowSandboxGateway(clerkUserId);

  if (!isAdmin) {
    return null;
  }

  const sbResult = await getSupabaseUserId(clerkUserId);

  if (sbResult.error || !sbResult.data) {
    return null;
  }

  return { clerkUserId, sbUserId: sbResult.data };
}
