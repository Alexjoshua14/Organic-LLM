import { beforeEach, describe, expect, test } from "bun:test";

import { sharedRatelimitLimit as mockLimit } from "../helpers/rate-limit-upstash";

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
