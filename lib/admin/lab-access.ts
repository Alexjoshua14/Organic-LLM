import "server-only";

import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { isAdminUser } from "@/lib/admin/read-admin-profile";
import { requireAdmin, type AdminContext } from "@/lib/admin/require-admin";
import { hasAgentAccounts, isAgentAccount } from "@/lib/agent-account/agent-account";

/**
 * Unfinished surfaces (labs, prototypes, Stage, the sandbox gateway): admins, plus agent test
 * accounts so coding agents can check in-progress work. An agent account is not an admin:
 * `/admin`, `/status`, admin APIs and admin-only models keep using `requireAdmin` /
 * `isAdminUser`.
 */
export async function requireLabAccess(): Promise<AdminContext | null> {
  const admin = await requireAdmin();

  if (admin) return admin;
  if (!hasAgentAccounts()) return null;

  const { userId } = await auth();

  if (!userId || !isAgentAccount(userId)) return null;
  const profile = await getSupabaseUserId(userId);

  return profile.error || !profile.data ? null : { clerkUserId: userId, sbUserId: profile.data };
}

/** Same rule as {@link requireLabAccess}, for callers that already have the Clerk id. */
export async function canSeeLabs(clerkUserId: string): Promise<boolean> {
  return isAgentAccount(clerkUserId) || (await isAdminUser(clerkUserId));
}
