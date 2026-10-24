import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { checkMemoryQdrant } from "@/lib/health/checks/memory-qdrant";

const originalFetch = globalThis.fetch;

describe("checkMemoryQdrant", () => {
  beforeEach(() => {
    process.env.MEMORY_API_HOST = "localhost";
    process.env.MEMORY_API_SECRET = "test-secret";
    delete process.env.MEMORY_API_PORT;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns ok when healthz succeeds without deep", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 200 }))
    ) as typeof fetch;

    const result = await checkMemoryQdrant(false);
    expect(result.status).toBe("ok");
    expect(result.summary).toBe("Reachable");
  });

  test("returns down when healthz fails", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 503 }))
    ) as typeof fetch;

    const result = await checkMemoryQdrant(false);
    expect(result.status).toBe("down");
    expect(result.summary).toContain("503");
  });

  test("summarises a Cloudflare challenge page instead of dumping it", async () => {
    const page = '<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>';

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(page, { status: 403 }))
    ) as typeof fetch;

    const result = await checkMemoryQdrant(false);
    expect(result.status).toBe("down");
    expect(result.summary).toContain("Cloudflare");
    expect(result.message ?? "").not.toContain("<");
  });

  test("sends Cloudflare Access service-token headers to healthz when configured", async () => {
    process.env.MEMORY_CF_ACCESS_CLIENT_ID = "id.access";
    process.env.MEMORY_CF_ACCESS_CLIENT_SECRET = "access-secret";

    const fetchMock = mock((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(new Response("", { status: 200 }))
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await checkMemoryQdrant(false);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;

    expect(headers["CF-Access-Client-Id"]).toBe("id.access");
    expect(headers["CF-Access-Client-Secret"]).toBe("access-secret");
    expect(result.config?.accessTokenConfigured).toBe("yes");
    expect(JSON.stringify(result)).not.toContain("access-secret");

    delete process.env.MEMORY_CF_ACCESS_CLIENT_ID;
    delete process.env.MEMORY_CF_ACCESS_CLIENT_SECRET;
  });

  test("returns degraded when secret not set", async () => {
    delete process.env.MEMORY_API_SECRET;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 200 }))
    ) as typeof fetch;

    const result = await checkMemoryQdrant(false);
    expect(result.status).toBe("degraded");
    expect(result.summary).toContain("MEMORY_API_SECRET");
  });
});
