import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import {
  registerUpstashRateLimitMocks,
  sharedRatelimitLimit as mockLimit,
} from "../helpers/rate-limit-upstash";

registerUpstashRateLimitMocks();

describe("Arcadia chat settings rate limit", () => {
  let arcadiaSettingsRateLimit: typeof import("@/lib/rate-limit/arcadia-chat-settings");

  beforeEach(async () => {
    mockLimit.mockClear();
    mockLimit.mockResolvedValue({ success: true, remaining: 5 });
    arcadiaSettingsRateLimit = await import("@/lib/rate-limit/arcadia-chat-settings");
  });

  test("checkArcadiaSettingsTitleLimit succeeds when under both limits", async () => {
    const result = await arcadiaSettingsRateLimit.checkArcadiaSettingsTitleLimit(
      "user-1",
      "chat-1"
    );

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(5);
    expect(mockLimit.mock.calls.length).toBe(2);
    expect((mockLimit.mock.calls[0] as string[])[0]).toBe("user-1:chat-1");
  });

  test("checkArcadiaSettingsSummaryLimit returns burst error when minute cap exceeded", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await arcadiaSettingsRateLimit.checkArcadiaSettingsSummaryLimit(
      "user-1",
      "chat-1"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("per minute");
    expect(mockLimit.mock.calls.length).toBe(1);
  });

  test("checkArcadiaSettingsTitleLimit returns bucket error when capacity exceeded", async () => {
    mockLimit
      .mockResolvedValueOnce({ success: true, remaining: 2 })
      .mockResolvedValueOnce({ success: false, remaining: 0 });

    const result = await arcadiaSettingsRateLimit.checkArcadiaSettingsTitleLimit(
      "user-1",
      "chat-1"
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("title regeneration limit");
    expect(mockLimit.mock.calls.length).toBe(2);
  });
});
