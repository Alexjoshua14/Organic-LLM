import "server-only";

import { auth } from "@clerk/nextjs/server";

import { readAdminProfile } from "@/lib/admin/read-admin-profile";

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

  try {
    const profile = await readAdminProfile(clerkUserId);

    if (!profile?.admin) return null;

    return { clerkUserId, sbUserId: profile.id };
  } catch {
    return null;
  }
}
