import { describe, expect, test } from "bun:test";

import {
  exchangeCountFromPersistedMessageCount,
  shouldAttemptInitialTitle,
  shouldRefreshSummary,
} from "@/lib/chat/summary-title-cadence";

describe("exchangeCountFromPersistedMessageCount", () => {
  test("pairs user+assistant messages into exchanges", () => {
    expect(exchangeCountFromPersistedMessageCount(0)).toBe(0);
    expect(exchangeCountFromPersistedMessageCount(1)).toBe(0);
    expect(exchangeCountFromPersistedMessageCount(2)).toBe(1);
    expect(exchangeCountFromPersistedMessageCount(3)).toBe(1);
    expect(exchangeCountFromPersistedMessageCount(6)).toBe(3);
    expect(exchangeCountFromPersistedMessageCount(10)).toBe(5);
  });
});

describe("shouldRefreshSummary", () => {
  test("fires on exchanges 1, 3, 5, 10, 15 and not between", () => {
    expect(shouldRefreshSummary(0)).toBe(false);
    expect(shouldRefreshSummary(1)).toBe(true);
    expect(shouldRefreshSummary(2)).toBe(false);
    expect(shouldRefreshSummary(3)).toBe(true);
    expect(shouldRefreshSummary(4)).toBe(false);
    expect(shouldRefreshSummary(5)).toBe(true);
    expect(shouldRefreshSummary(6)).toBe(false);
    expect(shouldRefreshSummary(9)).toBe(false);
    expect(shouldRefreshSummary(10)).toBe(true);
    expect(shouldRefreshSummary(15)).toBe(true);
  });
});

describe("shouldAttemptInitialTitle", () => {
  test("requires two persisted messages and no existing title", () => {
    expect(
      shouldAttemptInitialTitle({ persistedMessageCount: 0, threadAlreadyHasTitle: false })
    ).toBe(false);
    expect(
      shouldAttemptInitialTitle({ persistedMessageCount: 1, threadAlreadyHasTitle: false })
    ).toBe(false);
    expect(
      shouldAttemptInitialTitle({ persistedMessageCount: 2, threadAlreadyHasTitle: false })
    ).toBe(true);
    expect(
      shouldAttemptInitialTitle({ persistedMessageCount: 2, threadAlreadyHasTitle: true })
    ).toBe(false);
    expect(
      shouldAttemptInitialTitle({ persistedMessageCount: 4, threadAlreadyHasTitle: true })
    ).toBe(false);
  });
});
