/**
 * In-memory LRU + TTL cache for TTS v2 NDJSON stream payloads.
 * Bounded by entry count; not shared across server instances.
 */

export type TtsV2AudioCacheEntry = {
  streamData: string;
  timestamp: number;
};

export type TtsV2AudioCache = {
  get: (key: string) => TtsV2AudioCacheEntry | undefined;
  set: (key: string, entry: TtsV2AudioCacheEntry) => void;
};

type CreateTtsV2AudioCacheOptions = {
  /** Override clock (for tests). Defaults to `Date.now`. */
  now?: () => number;
};

/**
 * @param maxEntries - Hard cap; oldest entries evicted on insert when full.
 * @param ttlMs - Entries older than this at read time are removed and treated as miss.
 */
export function createTtsV2AudioCache(
  maxEntries: number,
  ttlMs: number,
  options?: CreateTtsV2AudioCacheOptions
): TtsV2AudioCache {
  const now = options?.now ?? Date.now;
  const map = new Map<string, TtsV2AudioCacheEntry>();

  function get(key: string): TtsV2AudioCacheEntry | undefined {
    const entry = map.get(key);
    if (!entry) return undefined;

    if (now() - entry.timestamp >= ttlMs) {
      map.delete(key);
      return undefined;
    }

    map.delete(key);
    map.set(key, entry);
    return entry;
  }

  function set(key: string, entry: TtsV2AudioCacheEntry): void {
    if (map.has(key)) {
      map.delete(key);
    } else if (map.size >= maxEntries) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) {
        map.delete(oldest);
      }
    }
    map.set(key, entry);
  }

  return { get, set };
}
