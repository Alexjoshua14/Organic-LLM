import "server-only";

import { auth } from "@clerk/nextjs/server";

import { shouldIncludeErrorDetail } from "./server-error";

import { isAdminUser } from "@/data/supabase/profiles";

/**
 * Whether the caller may see the full `detail` block on an error response.
 *
 * Non-production builds and `ORGANIC_EXPOSE_ERROR_DETAIL=true` short-circuit before
 * any I/O, so the happy path never pays for this check — it only runs on failures.
 */
export async function canSeeErrorDetail(knownClerkUserId?: string): Promise<boolean> {
  if (shouldIncludeErrorDetail(false)) return true;

  try {
    const clerkUserId = knownClerkUserId ?? (await auth()).userId;

    if (!clerkUserId) return false;

    return await isAdminUser(clerkUserId);
  } catch {
    return false;
  }
}
