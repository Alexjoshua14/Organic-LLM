import { describe, expect, test } from "bun:test";

import { safeFetch } from "@/lib/security/external-content/safe-fetch";
import type { DnsLookupFn } from "@/lib/security/external-content/safe-url";

const publicLookup: DnsLookupFn = async () => [{ address: "93.184.216.34", family: 4 }];

function mockResponse(
  init: ResponseInit & { body?: string; headers?: Record<string, string> }
): Response {
  return new Response(init.body ?? "", {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

describe("safeFetch", () => {
  test("blocks redirect to private host", async () => {
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);

      if (url.includes("public.example")) {
        return mockResponse({
          status: 302,
          headers: { Location: "https://127.0.0.1/secret" },
        });
      }

      return mockResponse({ status: 200, body: "ok" });
    };

    const result = await safeFetch("https://public.example/start", {
      fetchImpl,
      lookup: publicLookup,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unsafe_url");
    }
  });

  test("rejects disallowed content type", async () => {
    const fetchImpl = async () =>
      mockResponse({
        status: 200,
        body: "binary",
        headers: { "content-type": "application/octet-stream" },
      });

    const result = await safeFetch("https://example.com/file.bin", {
      fetchImpl,
      lookup: publicLookup,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("content_type");
    }
  });

  test("aborts oversized body", async () => {
    const huge = "x".repeat(5000);
    const fetchImpl = async () =>
      mockResponse({
        status: 200,
        body: huge,
        headers: { "content-type": "text/plain" },
      });

    const result = await safeFetch("https://example.com/huge", {
      fetchImpl,
      lookup: publicLookup,
      maxBytes: 100,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("size_exceeded");
    }
  });

  test("returns body for valid html response", async () => {
    const fetchImpl = async () =>
      mockResponse({
        status: 200,
        body: "<html><body><p>Hello</p></body></html>",
        headers: { "content-type": "text/html; charset=utf-8" },
      });

    const result = await safeFetch("https://example.com/page", {
      fetchImpl,
      lookup: publicLookup,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toContain("<p>Hello</p>");
      expect(result.finalUrl).toBe("https://example.com/page");
    }
  });
});
