import { describe, expect, test } from "bun:test";

import {
  describeElapsedSinceLastTalk,
  describeElapsedSinceTimestamp,
} from "@/lib/speak/elapsed";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("describeElapsedSinceLastTalk", () => {
  test("maps each bucket to its phrase", () => {
    expect(describeElapsedSinceLastTalk(30 * SECOND)).toBe("just now");
    expect(describeElapsedSinceLastTalk(20 * MINUTE)).toBe("a few minutes ago");
    expect(describeElapsedSinceLastTalk(3 * HOUR)).toBe("a little earlier today");
    expect(describeElapsedSinceLastTalk(12 * HOUR)).toBe("earlier today");
    expect(describeElapsedSinceLastTalk(30 * HOUR)).toBe("yesterday");
    expect(describeElapsedSinceLastTalk(4 * DAY)).toBe("a few days ago");
    expect(describeElapsedSinceLastTalk(10 * DAY)).toBe("about a week ago");
    expect(describeElapsedSinceLastTalk(20 * DAY)).toBe("a couple of weeks ago");
    expect(describeElapsedSinceLastTalk(90 * DAY)).toBe("a while back");
    expect(describeElapsedSinceLastTalk(500 * DAY)).toBe("a long time ago");
  });

  test("boundaries land in the newer bucket", () => {
    // Exactly 2 minutes is no longer "just now".
    expect(describeElapsedSinceLastTalk(2 * MINUTE)).toBe("a few minutes ago");
    // Exactly 24h is no longer "earlier today".
    expect(describeElapsedSinceLastTalk(DAY)).toBe("yesterday");
    // Exactly 7 days is no longer "a few days ago".
    expect(describeElapsedSinceLastTalk(7 * DAY)).toBe("about a week ago");
  });

  test("non-finite or negative input clamps to 'just now'", () => {
    expect(describeElapsedSinceLastTalk(-5000)).toBe("just now");
    expect(describeElapsedSinceLastTalk(Number.NaN)).toBe("just now");
    expect(describeElapsedSinceLastTalk(0)).toBe("just now");
  });
});

describe("describeElapsedSinceTimestamp", () => {
  test("returns null for a brand-new thread (no timestamp)", () => {
    expect(describeElapsedSinceTimestamp(null)).toBeNull();
    expect(describeElapsedSinceTimestamp(undefined)).toBeNull();
    expect(describeElapsedSinceTimestamp("not-a-date")).toBeNull();
  });

  test("describes the gap from an ISO timestamp to now", () => {
    const now = Date.parse("2026-07-20T12:00:00.000Z");
    const anHourAgo = new Date(now - HOUR).toISOString();
    const threeDaysAgo = new Date(now - 3 * DAY).toISOString();

    expect(describeElapsedSinceTimestamp(anHourAgo, now)).toBe("a little earlier today");
    expect(describeElapsedSinceTimestamp(threeDaysAgo, now)).toBe("a few days ago");
  });
});
