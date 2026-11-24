import "server-only";

import type { AdminContext } from "@/lib/admin/require-admin";

import { auth } from "@clerk/nextjs/server";

import { readAdminProfile } from "@/lib/admin/read-admin-profile";
import { readLabAccess } from "@/lib/admin/read-lab-access";

/**
 * Unfinished surfaces (labs, prototypes, Stage, the sandbox gateway): admins, plus accounts with
 * a `lab_access` row (docs/migrations/lab_access.sql), such as the agent test account. A lab
 * member is not an admin: `/admin`, `/status`, admin APIs and admin-only models keep using
 * `requireAdmin` / `isAdminUser`.
 *
 * Returns the profile id that grants access, or null. Throws when a membership read fails.
 */
export async function readLabProfileId(clerkUserId: string): Promise<string | null> {
  // Start both reads together so lab members don't wait for an admin denial first.
  // Capture rejection immediately; an admin can return without waiting for the lab read.
  const labResult = readLabAccess(clerkUserId).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  );
  const admin = await readAdminProfile(clerkUserId);

  if (admin?.admin) return admin.id;

  const lab = await labResult;

  if (!lab.ok) throw lab.error;

  return lab.value?.id ?? null;
}

/** The signed-in account's lab context, or null. Fails closed. */
export async function requireLabAccess(): Promise<AdminContext | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) return null;

  try {
    const sbUserId = await readLabProfileId(clerkUserId);

    return sbUserId ? { clerkUserId, sbUserId } : null;
  } catch {
    return null;
  }
}

/** Same rule as {@link requireLabAccess}, for callers that already have the Clerk id. */
export async function canSeeLabs(clerkUserId: string): Promise<boolean> {
  try {
    return (await readLabProfileId(clerkUserId)) !== null;
  } catch {
    return false;
  }
}
