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
