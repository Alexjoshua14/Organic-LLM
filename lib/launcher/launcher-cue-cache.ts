import type { HomepageRouteCandidate } from "@/lib/chat/thread-routing-candidates";

import { LAUNCHER_CUE_MAX_CHARS, LAUNCHER_CUES_TTL_MS } from "./launcher-timing";

/**
 * In-memory "where you left off" cues for the launcher's cards: thread id → one short line.
 *
 * Memory only, by design. The cues are decrypted summaries, and docs/thread-session-architecture.md
 * §5 requires a documented policy before decrypted content is persisted on the client. This
 * module never touches localStorage or IndexedDB, holds one key at a time (the signed-in user
 * plus scope), and caps every line, so its footprint is a few KB.
 *
 * Cards never wait on it. Titles, order and signals come from the sidebar cache; a cue fades in
 * when it arrives, and a failed or slow fetch leaves the card complete without one.
 */

export type CueFetcher = () => Promise<readonly HomepageRouteCandidate[]>;

const EMPTY_CUES: ReadonlyMap<string, string> = new Map();

/** One line, bounded: collapses whitespace and trims with an ellipsis. */
export function toCue(summary: string | null | undefined): string | null {
  const flat = summary?.replace(/\s+/g, " ").trim();

  if (!flat) return null;
  if (flat.length <= LAUNCHER_CUE_MAX_CHARS) return flat;

  return `${flat.slice(0, LAUNCHER_CUE_MAX_CHARS - 1).trimEnd()}…`;
}

export function createCueCache(options?: { ttlMs?: number; now?: () => number }) {
  const ttlMs = options?.ttlMs ?? LAUNCHER_CUES_TTL_MS;
  const now = options?.now ?? Date.now;

  let currentKey: string | null = null;
  let cues: ReadonlyMap<string, string> = EMPTY_CUES;
  let loadedAt = 0;
  let inFlight: { key: string; promise: Promise<void> } | null = null;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const isFresh = (key: string) => key === currentKey && now() - loadedAt < ttlMs;

  return {
    /** Cues for a key; a stable empty map when there are none yet. Safe as a store snapshot. */
    peek(key: string): ReadonlyMap<string, string> {
      return key === currentKey ? cues : EMPTY_CUES;
    },

    isFresh,

    /**
     * Fetches and stores cues unless they are fresh. Concurrent calls for a key share one
     * request. Never rejects: on failure the previous cues stay and the next open retries.
     */
    load(key: string, fetcher: CueFetcher): Promise<void> {
      if (isFresh(key)) return Promise.resolve();
      if (inFlight?.key === key) return inFlight.promise;

      const promise = (async () => {
        try {
          const candidates = await fetcher();
          const next = new Map<string, string>();

          for (const candidate of candidates) {
            if (candidate.kind !== "thread") continue;

            const cue = toCue(candidate.summaryText);

            if (cue) next.set(candidate.routeKey, cue);
          }

          // A different user or scope replaces the old entry rather than adding to it.
          currentKey = key;
          cues = next;
          loadedAt = now();
          emit();
        } catch {
          // Keep whatever we had; cards render fine without cues.
        } finally {
          if (inFlight?.key === key) inFlight = null;
        }
      })();

      inFlight = { key, promise };

      return promise;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    /** Sign-out and tests. */
    clear() {
      currentKey = null;
      cues = EMPTY_CUES;
      loadedAt = 0;
      inFlight = null;
      emit();
    },
  };
}

export type CueCache = ReturnType<typeof createCueCache>;

/** The app-wide cache. */
export const launcherCueCache: CueCache = createCueCache();

/** Client fetcher for {@link CueCache.load}; throws on a non-2xx so the cache keeps old cues. */
export function candidateFetcher(coalescenceMode: boolean): CueFetcher {
  return async () => {
    const res = await fetch(`/api/launcher/candidates?coalescence=${coalescenceMode}`);

    if (!res.ok) throw new Error(`launcher candidates ${res.status}`);

    const json = (await res.json()) as { data?: HomepageRouteCandidate[] };

    return Array.isArray(json.data) ? json.data : [];
  };
}

export function cueCacheKey(userId: string, coalescenceMode: boolean): string {
  return `${userId}:${coalescenceMode ? "all" : "main"}`;
}
