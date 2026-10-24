/**
 * Process-local single-flight: concurrent callers for the same key share one Promise.
 * Cross-process dedupe relies on the durable Supabase cache.
 */
export function createSingleFlight<T>() {
  const inflight = new Map<string, Promise<T>>();

  return {
    async run(key: string, work: () => Promise<T>): Promise<T> {
      const existing = inflight.get(key);

      if (existing) return existing;

      const promise = (async () => {
        try {
          return await work();
        } finally {
          inflight.delete(key);
        }
      })();

      inflight.set(key, promise);

      return promise;
    },

    /** Test helper — whether a key currently has an in-flight promise. */
    has(key: string): boolean {
      return inflight.has(key);
    },

    /** Test helper — clear all in-flight entries. */
    clear(): void {
      inflight.clear();
    },
  };
}
