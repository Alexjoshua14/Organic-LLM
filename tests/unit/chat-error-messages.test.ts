import { describe, expect, test } from "bun:test";

import { getChatErrorMessage } from "@/lib/chat/error-messages";

const body = (value: Record<string, unknown>) => new Error(JSON.stringify(value));

describe("getChatErrorMessage", () => {
  test.each([
    "profile_unavailable",
    "rate_limit_unavailable",
    "stream_capacity_unavailable",
    "stream_admission_unavailable",
  ])("a %s 503 shows retry copy, not JSON", (code) => {
    const message = getChatErrorMessage(
      body({ error: "Chat temporarily unavailable. Please retry.", status: 503, code })
    );

    expect(message).toBe("Chat is temporarily unavailable. Please try again in a moment.");
  });

  test("codes win over the shared 429 status", () => {
    expect(getChatErrorMessage(body({ status: 429, code: "stream_limit", error: "x" }))).toContain(
      "maximum number of replies"
    );
    expect(getChatErrorMessage(body({ status: 429, code: "thread_busy", error: "x" }))).toContain(
      "still replying"
    );
    expect(getChatErrorMessage(body({ status: 429, code: "message_limit", error: "x" }))).toBe(
      "Rate limit reached. Please wait a moment before sending again."
    );
  });

  test("plan_unavailable has its own copy", () => {
    expect(
      getChatErrorMessage(body({ status: 503, code: "plan_unavailable", error: "x" }))
    ).toContain("Usage limits can't be checked");
  });

  test("an unmapped JSON body never reaches the user verbatim", () => {
    const unmappedServer = getChatErrorMessage(body({ status: 502, code: "mystery", error: "x" }));
    const unmappedClient = getChatErrorMessage(body({ status: 418, internal: "details" }));
    const noStatus = getChatErrorMessage(new Error('{"detail":"stack trace here"}'));

    expect(unmappedServer).toBe("Chat is temporarily unavailable. Please try again in a moment.");
    for (const message of [unmappedClient, noStatus]) {
      expect(message).toBe("Something went wrong. Please try again.");
    }
  });

  test("plain-text errors keep their existing behavior", () => {
    expect(
      getChatErrorMessage(new Error("Usage ledger unavailable; further model steps are paused"))
    ).toBe("Usage ledger unavailable; further model steps are paused");
    expect(getChatErrorMessage(new Error("Too many requests"))).toBe(
      "Rate limit reached. Please wait a moment before sending again."
    );
    expect(getChatErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
  });
});
