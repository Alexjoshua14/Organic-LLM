import { describe, expect, test } from "bun:test";

import {
  isRetryableConnectError,
  RealtimeConnectError,
} from "@/lib/speak/transport/voice-transport";

describe("RealtimeConnectError", () => {
  test("keeps the message the UI already shows", () => {
    const error = new RealtimeConnectError(500, "Internal Server Error");

    expect(error.message).toBe("Realtime connect failed (500): Internal Server Error");
    expect(error.status).toBe(500);
    expect(error.detail).toBe("Internal Server Error");
  });
});

describe("isRetryableConnectError", () => {
  test("retries OpenAI server errors", () => {
    expect(isRetryableConnectError(new RealtimeConnectError(500, ""))).toBe(true);
    expect(isRetryableConnectError(new RealtimeConnectError(503, ""))).toBe(true);
  });

  test("does not retry client errors — a new secret for the same config fails the same way", () => {
    expect(isRetryableConnectError(new RealtimeConnectError(400, "bad offer"))).toBe(false);
    expect(isRetryableConnectError(new RealtimeConnectError(401, "expired"))).toBe(false);
  });

  test("does not retry failures outside the SDP exchange", () => {
    expect(isRetryableConnectError(new Error("Permission denied"))).toBe(false);
    expect(isRetryableConnectError("Internal Server Error")).toBe(false);
  });
});
