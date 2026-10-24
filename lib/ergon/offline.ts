/**
 * Ergon offline policy — what may live in localStorage vs what still needs the network.
 *
 * Ergon’s source of truth is Supabase (server actions). There is no write-queue / flush
 * path, so we only cache a **read snapshot** of the last successfully loaded board.
 * Mutations, LLM enhance/refine, and first-load auth still require the network.
 */

/** localStorage key for the last successful task list snapshot. */
export const ERGON_TASK_SNAPSHOT_STORAGE_KEY = "organic-llm.ergon.tasks.v1";

/** Keys that must never be written into an Ergon client cache. */
export const ERGON_OFFLINE_REFUSED_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "api_key",
  "apiKey",
  "password",
  "clerk",
  "authorization",
  "private_key",
  "session",
] as const;

export type ErgonOfflineCapability =
  | "view_cached_board"
  | "mutate_tasks"
  | "llm_enhance"
  | "auth_bootstrap";

/** What works offline once a snapshot exists on the device. */
export function ergonOfflineAllows(capability: ErgonOfflineCapability): boolean {
  return capability === "view_cached_board";
}

/** Quiet copy shown only while the device reports offline. */
export const ERGON_OFFLINE_STATUS_LINE =
  "Offline — showing last saved list. Saving needs a connection.";

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;

  return navigator.onLine !== false;
}

/**
 * Walk a JSON value; return the first refused key found, or null if the payload is safe
 * to cache as an Ergon board snapshot (tasks / categories only — never tokens or hub notes).
 */
export function findRefusedOfflineCacheKey(value: unknown, depth = 0): string | null {
  if (depth > 8 || value == null) return null;
  if (typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findRefusedOfflineCacheKey(item, depth + 1);

      if (hit) return hit;
    }

    return null;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase();

    if (
      ERGON_OFFLINE_REFUSED_KEYS.some(
        (refused) =>
          normalized === refused.toLowerCase() || normalized.includes(refused.toLowerCase())
      )
    ) {
      return key;
    }

    // Private hub / strategy notes must not land in the Ergon task cache.
    if (normalized === "hub_notes" || normalized === "private_notes" || normalized === "strategy") {
      return key;
    }

    const hit = findRefusedOfflineCacheKey(child, depth + 1);

    if (hit) return hit;
  }

  return null;
}

export function canCacheErgonSnapshot(value: unknown): boolean {
  return findRefusedOfflineCacheKey(value) === null;
}
