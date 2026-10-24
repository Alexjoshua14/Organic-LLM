import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import {
  registerUpstashRateLimitMocks,
  sharedRatelimitLimit as mockLimit,
} from "../helpers/rate-limit-upstash";

registerUpstashRateLimitMocks();

describe("External fetch rate limit", () => {
  let externalFetchRateLimit: typeof import("@/lib/rate-limit/external-fetch");

  beforeEach(async () => {
    mockLimit.mockClear();
    mockLimit.mockResolvedValue({ success: true, remaining: 10 });
    externalFetchRateLimit = await import("@/lib/rate-limit/external-fetch");
  });

  test("checkExternalFetchLimit returns success when under limit", async () => {
    const result = await externalFetchRateLimit.checkExternalFetchLimit("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(10);
    expect(mockLimit.mock.calls.length).toBe(1);
  });

  test("checkExternalFetchLimit returns error when exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await externalFetchRateLimit.checkExternalFetchLimit("user-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Too many external fetch requests");
  });
});
