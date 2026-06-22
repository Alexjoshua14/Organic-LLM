import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import {
  createConfirmedFetchToken,
  requiresModelFetchConfirmation,
  verifyFetchConfirmation,
} from "@/lib/security/external-content/confirm";

const TEST_SECRET = "test-external-fetch-confirm-secret";

describe("model fetch confirmation", () => {
  beforeEach(() => {
    process.env.EXTERNAL_FETCH_CONFIRM_SECRET = TEST_SECRET;
  });

  test("requiresModelFetchConfirmation is true for direct model fetches", () => {
    expect(requiresModelFetchConfirmation("direct", "model")).toBe(true);
    expect(requiresModelFetchConfirmation("direct", "user")).toBe(false);
    expect(requiresModelFetchConfirmation("auto", "model")).toBe(false);
  });

  test("createConfirmedFetchToken and verify succeed for matching URL", () => {
    const tokenResult = createConfirmedFetchToken("https://example.com/doc");

    expect("signature" in tokenResult).toBe(true);

    const verified = verifyFetchConfirmation(tokenResult, "https://example.com/doc");

    expect(verified.ok).toBe(true);
  });

  test("verify rejects URL mismatch", () => {
    const tokenResult = createConfirmedFetchToken("https://example.com/a");

    expect("signature" in tokenResult).toBe(true);

    const verified = verifyFetchConfirmation(tokenResult, "https://example.com/b");

    expect(verified.ok).toBe(false);
  });

  test("verify rejects expired token", () => {
    const issued = createConfirmedFetchToken("https://example.com/x", { ttlMs: 1 });

    expect("signature" in issued).toBe(true);

    const expired = {
      ...issued,
      expiresAt: Date.now() - 1,
    };

    const verified = verifyFetchConfirmation(expired, "https://example.com/x");

    expect(verified.ok).toBe(false);
  });

  test("verify rejects missing token", () => {
    const verified = verifyFetchConfirmation(undefined, "https://example.com/page");

    expect(verified.ok).toBe(false);
  });
});
