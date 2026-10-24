import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import {
  registerUpstashRateLimitMocks,
  sharedRatelimitGetRemaining as mockGetRemaining,
  sharedRatelimitLimit as mockLimit,
} from "../helpers/rate-limit-upstash";

registerUpstashRateLimitMocks();

describe("TTS rate limit (lib/rate-limit/tts)", () => {
  let ttsRateLimit: typeof import("@/lib/rate-limit/tts");

  beforeEach(async () => {
    mockLimit.mockClear();
    mockGetRemaining.mockClear();
    mockLimit.mockResolvedValue({ success: true, remaining: 10 });
    mockGetRemaining.mockResolvedValue({ remaining: 50_000 });
    ttsRateLimit = await import("@/lib/rate-limit/tts");
  });

  test("checkTtsRequestLimit returns success when under limit", async () => {
    const result = await ttsRateLimit.checkTtsRequestLimit("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.error).toBe(undefined);
    expect(mockLimit.mock.calls.length).toBe(1);
    expect((mockLimit.mock.calls[0] as string[])[0]).toBe("user-1");
    expect(mockGetRemaining.mock.calls.length).toBe(0);
  });

  test("checkTtsRequestLimit returns error when rate limit exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await ttsRateLimit.checkTtsRequestLimit("user-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Too many TTS requests");
    expect(mockLimit.mock.calls.length).toBe(1);
  });

  test("checkTtsCharLimit returns success without Redis when charCount is zero", async () => {
    const result = await ttsRateLimit.checkTtsCharLimit("user-1", 0);

    expect(result.success).toBe(true);
    expect(mockGetRemaining.mock.calls.length).toBe(0);
    expect(mockLimit.mock.calls.length).toBe(0);
  });

  test("checkTtsCharLimit returns success and records usage when under limit", async () => {
    mockGetRemaining.mockResolvedValueOnce({ remaining: 10_000 });

    const result = await ttsRateLimit.checkTtsCharLimit("user-1", 2_500);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(7_500);
    expect(mockGetRemaining.mock.calls.length).toBe(1);
    expect((mockGetRemaining.mock.calls[0] as string[])[0]).toBe("user-1");
    expect(mockLimit.mock.calls.length).toBe(1);
    expect((mockLimit.mock.calls[0] as [string, { rate: number }])[0]).toBe("user-1");
    expect((mockLimit.mock.calls[0] as [string, { rate: number }])[1]).toEqual({ rate: 2_500 });
  });

  test("checkTtsCharLimit returns error when character budget is insufficient", async () => {
    mockGetRemaining.mockResolvedValueOnce({ remaining: 100 });

    const result = await ttsRateLimit.checkTtsCharLimit("user-1", 500);

    expect(result.success).toBe(false);
    expect(result.error).toBe("TTS character limit exceeded");
    expect(result.remaining).toBe(100);
    expect(mockGetRemaining.mock.calls.length).toBe(1);
    expect(mockLimit.mock.calls.length).toBe(0);
  });
});
