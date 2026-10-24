import { describe, expect, test } from "bun:test";

import {
  AION_PRESENCE_DAILY_TURN_RATE_LIMIT,
  AION_PRESENCE_MINUTE_RATE_LIMIT,
  catalogEntryById,
} from "@/lib/rate-limit/catalog";

describe("aion presence budget catalog", () => {
  test("minute and daily-turn entries are registered with positive caps", () => {
    expect(AION_PRESENCE_MINUTE_RATE_LIMIT.cap).toBeGreaterThan(0);
    expect(AION_PRESENCE_DAILY_TURN_RATE_LIMIT.cap).toBeGreaterThan(0);
    expect(catalogEntryById("aion.presence.minute")?.prefix).toBe(
      "ratelimit:aion:presence-minute"
    );
    expect(catalogEntryById("aion.presence.daily-turns")?.prefix).toBe(
      "ratelimit:aion:presence-daily-turns"
    );
  });
});
