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
