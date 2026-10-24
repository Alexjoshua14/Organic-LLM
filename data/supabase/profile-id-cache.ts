import "server-only";

import type { Result } from "@/types";

import { getSupabaseUserId } from "./profiles";

/** Clerk id → profile id never changes for a live account; skip the lookup on hot reads. */
const SUPABASE_USER_ID_CACHE_TTL_MS = 5 * 60_000;
const SUPABASE_USER_ID_CACHE_MAX = 1_000;

const supabaseUserIdCache = new Map<string, { id: string; expiresAt: number }>();

/**
 * `getSupabaseUserId` with a per-instance cache. Only successful lookups are cached,
 * keyed by the already-authenticated Clerk id. Use on hot read paths (sidebar list).
 *
 * Lives outside `profiles.ts` because that file is `"use server"`: every export there
 * is a client-callable action.
 */
export async function getSupabaseUserIdCached(clerkUserId: string): Promise<Result<string>> {
  const hit = supabaseUserIdCache.get(clerkUserId);

  if (hit && hit.expiresAt > Date.now()) return { data: hit.id, error: null };

  const result = await getSupabaseUserId(clerkUserId);

  if (result.data) {
    if (supabaseUserIdCache.size >= SUPABASE_USER_ID_CACHE_MAX) {
      const oldest = supabaseUserIdCache.keys().next().value;

      if (oldest !== undefined) supabaseUserIdCache.delete(oldest);
    }
    supabaseUserIdCache.set(clerkUserId, {
      id: result.data,
      expiresAt: Date.now() + SUPABASE_USER_ID_CACHE_TTL_MS,
    });
  }

  return result;
}

/** Test hook. */
export function clearSupabaseUserIdCache(): void {
  supabaseUserIdCache.clear();
}
