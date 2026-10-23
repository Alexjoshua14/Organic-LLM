import "server-only";

import type { Result } from "@/types";

/**
 * Clerk user id → Supabase profile id, reused across requests on this server instance.
 *
 * Safe to cache because of what the lookup is: `select id from profiles where clerk_user_id = ?`
 * returns one UUID, the row is created once by the Clerk `user.created` webhook, and no app code
 * changes or deletes a profile's id. The TTL only bounds staleness from edits made outside the
 * app. Failures and misses are never cached, so a brand-new signup resolves as soon as its
 * webhook lands. Concurrent lookups for the same user share one query.
 */
export const PROFILE_ID_TTL_MS = 10 * 60_000;

/** Oldest entries are evicted beyond this; ~100 bytes each. */
export const PROFILE_ID_CACHE_MAX = 5_000;

const cache = new Map<string, { profileId: string; expiresAt: number }>();
const pending = new Map<string, Promise<Result<string>>>();

export async function cachedProfileId(
  clerkUserId: string,
  load: () => Promise<Result<string>>,
  now: () => number = Date.now
): Promise<Result<string>> {
  const hit = cache.get(clerkUserId);

  if (hit && hit.expiresAt > now()) {
    return { data: hit.profileId, error: null };
  }
  cache.delete(clerkUserId);

  const inFlight = pending.get(clerkUserId);

  if (inFlight) return inFlight;

  const request = load()
    .then((result) => {
      if (!result.error && result.data) {
        if (cache.size >= PROFILE_ID_CACHE_MAX) {
          const oldest = cache.keys().next().value;

          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(clerkUserId, { profileId: result.data, expiresAt: now() + PROFILE_ID_TTL_MS });
      }

      return result;
    })
    .finally(() => pending.delete(clerkUserId));

  pending.set(clerkUserId, request);

  return request;
}

/** Tests only: start from an empty cache. */
export function clearProfileIdCache(): void {
  cache.clear();
  pending.clear();
}
