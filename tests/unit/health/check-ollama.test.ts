import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { checkOllama } from "@/lib/health/checks/ollama";

const originalFetch = globalThis.fetch;

describe("checkOllama", () => {
  beforeEach(() => {
    process.env.OLLAMA_URL = "http://127.0.0.1:11434";
    process.env.OLLAMA_MODEL = "llama3.2";
    delete process.env.OLLAMA_PLAN_MODEL;
    delete process.env.OLLAMA_EMBED_MODEL;
    delete process.env.OLLAMA_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns ok when tags succeed and models present", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            models: [{ name: "llama3.2:latest" }, { name: "nomic-embed-text:latest" }],
          }),
          { status: 200 }
        )
      )
    ) as typeof fetch;

    const result = await checkOllama();
    expect(result.status).toBe("ok");
    expect(result.id).toBe("ollama");
  });

  test("sends Cloudflare Access service-token headers when configured", async () => {
    process.env.OLLAMA_CF_ACCESS_CLIENT_ID = "id.access";
    process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET = "access-secret";

    const fetchMock = mock((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({ models: [{ name: "llama3.2:latest" }, { name: "nomic-embed-text" }] }),
          { status: 200 }
        )
      )
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await checkOllama();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;

    expect(headers["CF-Access-Client-Id"]).toBe("id.access");
    expect(headers["CF-Access-Client-Secret"]).toBe("access-secret");
    expect(result.config?.accessTokenConfigured).toBe("yes");
    expect(JSON.stringify(result)).not.toContain("access-secret");

    delete process.env.OLLAMA_CF_ACCESS_CLIENT_ID;
    delete process.env.OLLAMA_CF_ACCESS_CLIENT_SECRET;
  });

  test("returns down when tags request fails", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("unavailable", { status: 503 }))
    ) as typeof fetch;

    const result = await checkOllama();
    expect(result.status).toBe("down");
    expect(result.summary).toContain("503");
  });

  test("returns degraded when required model missing", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ models: [{ name: "llama3.2:latest" }] }), {
          status: 200,
        })
      )
    ) as typeof fetch;

    const result = await checkOllama();
    expect(result.status).toBe("degraded");
    expect(result.summary).toContain("not loaded");
  });
});
