import { describe, expect, test } from "bun:test";

import { assertSafePublicHttpsUrl } from "@/lib/strata/safe-url";

describe("getWebpageContent SSRF guard (assertSafePublicHttpsUrl)", () => {
  test("blocks loopback hosts", () => {
    expect(assertSafePublicHttpsUrl("https://127.0.0.1/admin").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("https://localhost/").ok).toBe(false);
  });

  test("blocks metadata endpoints", () => {
    expect(assertSafePublicHttpsUrl("https://169.254.169.254/latest/meta-data/").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("https://metadata.google.internal/").ok).toBe(false);
  });

  test("blocks private RFC1918 addresses", () => {
    expect(assertSafePublicHttpsUrl("https://10.0.0.1/").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("https://192.168.1.1/").ok).toBe(false);
  });

  test("blocks non-https schemes", () => {
    expect(assertSafePublicHttpsUrl("http://example.com/").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("file:///etc/passwd").ok).toBe(false);
  });

  test("allows public https URLs", () => {
    const result = assertSafePublicHttpsUrl("https://example.com/article");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.href).toBe("https://example.com/article");
    }
  });
});
