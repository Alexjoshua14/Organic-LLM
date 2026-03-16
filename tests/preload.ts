/**
 * Loaded before tests so mocks are applied before any test file imports.
 * - Mocks Redis/Upstash so no network in CI; lib/rate-limit/llm gets mocked deps.
 * - Loads real rabbitholes once so tests can spread it in partial mocks (avoids
 *   "advanceGenerationStep is undefined" when other files mock rabbitholes).
 */
import { mock } from "bun:test";

declare global {
  // eslint-disable-next-line no-var
  var __realRabbitholes: typeof import("@/data/supabase/rabbitholes");
}

mock.module("server-only", () => ({}));
mock.module("@/lib/supabase/server", () => ({
  supabaseServer: async () =>
    ({
      from: () => ({
        update: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }) as never,
}));

// Prevent any test from loading real Redis (avoids "fetch() URL is invalid" in CI)
mock.module("@upstash/redis", () => ({
  Redis: class {
    request = () => Promise.resolve({ data: undefined, error: null });
  },
}));
mock.module("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = (_n: number, _w: string) => ({});
    limit = () => Promise.resolve({ success: true, remaining: 10 });
    getRemaining = () => Promise.resolve({ remaining: 100_000 });
  },
}));
mock.module("@/lib/redis/redis", () => ({ redis: {} }));

// Load real rabbitholes once (after supabase mock) so tests can use it in partial mocks
const rabbitholes = await import("@/data/supabase/rabbitholes");
globalThis.__realRabbitholes = rabbitholes;
