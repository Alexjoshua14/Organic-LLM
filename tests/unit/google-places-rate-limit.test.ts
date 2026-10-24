import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import {
  registerUpstashRateLimitMocks,
  sharedRatelimitLimit as mockLimit,
} from "../helpers/rate-limit-upstash";

registerUpstashRateLimitMocks();

describe("Google Places rate limit", () => {
  let googlePlacesRateLimit: typeof import("@/lib/rate-limit/google-places");

  beforeEach(async () => {
    mockLimit.mockClear();
    mockLimit.mockResolvedValue({ success: true, remaining: 50 });
    googlePlacesRateLimit = await import("@/lib/rate-limit/google-places");
  });

  test("checkGooglePlacesLimit returns success when under limit", async () => {
    const result = await googlePlacesRateLimit.checkGooglePlacesLimit("user-1");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(50);
    expect(mockLimit.mock.calls.length).toBe(1);
    expect(mockLimit.mock.calls[0]?.[0]).toBe("user-1");
  });

  test("checkGooglePlacesLimit returns error when exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await googlePlacesRateLimit.checkGooglePlacesLimit("user-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Too many Google Places API requests");
  });
});
