import { mock } from "bun:test";

/**
 * One Ratelimit mock for the whole unit run. `00-llm-rate-limit` and `chats-rate-limit`
 * must not each call `mock.module("@upstash/ratelimit")` — last file wins and breaks the other.
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
