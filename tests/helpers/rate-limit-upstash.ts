import { mock } from "bun:test";

/**
 * Single shared Upstash mock wired into `@upstash/ratelimit` for the whole test run.
 * Must be registered from `tests/preload.ts` before any `lib/rate-limit/*` module loads.
 * Unit tests import these handles and call `mockImplementation` / `mockResolvedValue` in `beforeEach`.
 */
export const sharedRatelimitLimit = mock(
  async (_id: string, _opts?: { rate?: number }) => ({
    success: true,
    remaining: 10,
  })
);

export const sharedRatelimitGetRemaining = mock(async (_id: string) => ({
  remaining: 100_000,
}));

let registered = false;

export function registerUpstashRateLimitMocks(): void {
  if (registered) {
    return;
  }
  registered = true;

  mock.module("@upstash/redis", () => ({
    Redis: class {
      request = () => Promise.resolve({ data: undefined, error: null });
    },
  }));
  mock.module("@upstash/ratelimit", () => ({
    Ratelimit: class {
      static slidingWindow = (_n: number, _w: string) => ({});
      limit = sharedRatelimitLimit;
      getRemaining = sharedRatelimitGetRemaining;
    },
  }));
  mock.module("@/lib/redis/redis", () => ({ redis: {} }));
}
