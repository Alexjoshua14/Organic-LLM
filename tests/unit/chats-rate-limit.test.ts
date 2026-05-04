import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockLimit = mock(async (_id: string) => ({
  success: true,
  remaining: 240,
}));

mock.module("@upstash/redis", () => ({
  Redis: class {
    request = () => Promise.resolve({ data: undefined, error: null });
  },
}));
mock.module("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = (_n: number, _w: string) => ({});
    limit = mockLimit;
  },
}));
mock.module("@/lib/redis/redis", () => ({ redis: {} }));

describe("Chats list rate limit (lib/rate-limit/chats)", () => {
  let chatsRateLimit: typeof import("@/lib/rate-limit/chats");

  beforeEach(async () => {
    mockLimit.mockClear();
    mockLimit.mockResolvedValue({ success: true, remaining: 240 });
    chatsRateLimit = await import("@/lib/rate-limit/chats");
  });

  test("checkChatsListLimit returns success when under limit", async () => {
    const result = await chatsRateLimit.checkChatsListLimit("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(240);
    expect(result.error).toBe(undefined);
    expect(mockLimit.mock.calls.length).toBe(1);
    expect((mockLimit.mock.calls[0] as string[])[0]).toBe("user-1");
  });

  test("checkChatsListLimit returns error when rate limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await chatsRateLimit.checkChatsListLimit("user-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("240");
    expect(result.error).toContain("per hour");
  });
});
