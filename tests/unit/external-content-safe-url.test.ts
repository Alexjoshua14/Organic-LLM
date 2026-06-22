import { describe, expect, test } from "bun:test";

import { assertSafePublicHttpsUrl } from "@/lib/security/external-content/safe-url";
import {
  resolveAndAssertSafeHost,
  type DnsLookupFn,
} from "@/lib/security/external-content/safe-url-resolved";

describe("resolveAndAssertSafeHost", () => {
  test("rejects DNS that resolves to private IPv4", async () => {
    const lookup: DnsLookupFn = async () => [{ address: "10.0.0.5", family: 4 }];

    const result = await resolveAndAssertSafeHost("example.com", lookup);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("not allowed");
    }
  });

  test("rejects DNS that resolves to loopback", async () => {
    const lookup: DnsLookupFn = async () => [{ address: "127.0.0.1", family: 4 }];

    const result = await resolveAndAssertSafeHost("evil.example", lookup);

    expect(result.ok).toBe(false);
  });

  test("allows public DNS records", async () => {
    const lookup: DnsLookupFn = async () => [
      { address: "93.184.216.34", family: 4 },
    ];

    const result = await resolveAndAssertSafeHost("example.com", lookup);

    expect(result.ok).toBe(true);
  });

  test("rejects if any record in multi-record answer is private", async () => {
    const lookup: DnsLookupFn = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.1", family: 4 },
    ];

    const result = await resolveAndAssertSafeHost("dual.example", lookup);

    expect(result.ok).toBe(false);
  });
});

describe("assertSafePublicHttpsUrl", () => {
  test("blocks loopback hosts", () => {
    expect(assertSafePublicHttpsUrl("https://127.0.0.1/admin").ok).toBe(false);
    expect(assertSafePublicHttpsUrl("https://localhost/").ok).toBe(false);
  });

  test("allows public https URLs", () => {
    const result = assertSafePublicHttpsUrl("https://example.com/article");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.href).toBe("https://example.com/article");
    }
  });
});
