import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserIdCached } from "@/data/supabase/profile-id-cache";
import { ProfileNotFoundError } from "@/data/supabase/profile-id-lookup";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/api/profile-actor.ts");

export type ProfileActor = { sbUserId: string; clerkUserId: string };

type ProfileLookup = typeof getSupabaseUserIdCached;

let lookupProfileId: ProfileLookup = getSupabaseUserIdCached;

/** Test seam (avoids module stubs that leak across files). Pass null to restore. */
export function setProfileLookupForTests(lookup: ProfileLookup | null): void {
  lookupProfileId = lookup ?? getSupabaseUserIdCached;
}

/**
 * Authenticate with Clerk, then resolve the Organic profile id. Clerk is used only to prove who
 * the caller is; all stored data is keyed by the profile id, so the auth provider stays
 * swappable. Returns a ready-to-send error response on failure.
 */
export async function requireProfileActor(): Promise<
  { actor: ProfileActor; error: null } | { actor: null; error: Response }
> {
  const { userId } = await auth();

  if (!userId) {
    return { actor: null, error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const profile = await lookupProfileId(userId);

  if (!profile.data) {
    if (profile.error instanceof ProfileNotFoundError) {
      return { actor: null, error: Response.json({ error: "Profile not found" }, { status: 404 }) };
    }

    logger.error("requireProfileActor", "Profile lookup failed");

    return {
      actor: null,
      error: Response.json({ error: "Temporarily unavailable" }, { status: 503 }),
    };
  }

  return { actor: { sbUserId: profile.data, clerkUserId: userId }, error: null };
}
