import { describe, expect, test } from "bun:test";

import { assertSafePublicHttpsUrl } from "@/lib/strata/safe-url";

describe("assertSafePublicHttpsUrl", () => {
  test("accepts normal https URL", () => {
    const r = assertSafePublicHttpsUrl("https://example.com/path?q=1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.hostname).toBe("example.com");
    }
  });

  test("rejects http", () => {
    const r = assertSafePublicHttpsUrl("http://example.com/");
    expect(r.ok).toBe(false);
  });

  test("rejects localhost", () => {
    expect(assertSafePublicHttpsUrl("https://localhost/foo").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("https://127.0.0.1/").ok).toBe(false);
  });

  test("rejects private IPv4", () => {
    expect(assertSafePublicHttpsUrl("https://10.0.0.1/").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("https://192.168.1.1/").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("https://172.16.0.1/").ok).toBe(false);
  });

  test("rejects .local", () => {
    expect(assertSafePublicHttpsUrl("https://mybox.local/").ok).toBe(false);
  });

  test("rejects credentials in URL", () => {
    expect(assertSafePublicHttpsUrl("https://user:pass@example.com/").ok).toBe(false);
  });
});
