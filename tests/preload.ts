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

// Prevent any test from loading real Redis (avoids "fetch() URL is invalid" in CI).
// Do not mock @upstash/ratelimit here so llm-rate-limit.test's mock (with mockLimit) is
// used when lib/rate-limit/llm loads; that test runs first (00-llm-rate-limit.test.ts).
mock.module("@upstash/redis", () => ({
  Redis: class {
    request = () => Promise.resolve({ data: undefined, error: null });
  },
}));
mock.module("@/lib/redis/redis", () => ({ redis: {} }));

// Load real rabbitholes once (after supabase mock) so tests can use it in partial mocks
const rabbitholes = await import("@/data/supabase/rabbitholes");
globalThis.__realRabbitholes = rabbitholes;
