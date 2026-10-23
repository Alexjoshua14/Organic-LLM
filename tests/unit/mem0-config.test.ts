import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("@/config/memory-qdrant-client", () => ({
  getMemoryQdrantClient: () => ({}),
}));

/** Stable mock URL — mem0-config should wire this into embedder.config.url. */
const MOCK_OLLAMA_URL = "https://ollama.example.com";

describe("mem0-config embedder", () => {
  test("uses OLLAMA_URL for the Mem0 Ollama embedder", async () => {
    const { createMem0Config } = await import("@/config/mem0-config");
    const config = createMem0Config({ ollamaUrl: MOCK_OLLAMA_URL });

    expect(config.embedder.config.url).toBe(MOCK_OLLAMA_URL);
    expect(config.embedder.config.embeddingDims).toBe(768);
  });
});

describe("installMem0OllamaFetch", () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.OLLAMA_URL;
  const originalApiKey = process.env.OLLAMA_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = originalUrl;
    if (originalApiKey === undefined) delete process.env.OLLAMA_API_KEY;
    else process.env.OLLAMA_API_KEY = originalApiKey;
  });

  test("adds Authorization for requests to OLLAMA_URL", async () => {
    process.env.OLLAMA_URL = "https://ollama.example.com";
    process.env.OLLAMA_API_KEY = "test-token";

    const calls: Array<{ url: string; headers: Headers }> = [];

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );

      calls.push({ url, headers });

      return new Response(JSON.stringify({ embeddings: [[0.1]] }), { status: 200 });
    };

    // Each run needs a fresh installation guard because it replaces global fetch.
    const { installMem0OllamaFetch } = await import(
      `@/lib/memory/install-mem0-ollama-fetch?test=${crypto.randomUUID()}`
    );

    installMem0OllamaFetch();

    await globalThis.fetch("https://ollama.example.com/api/embed", {
      method: "POST",
      body: "{}",
    });
    await globalThis.fetch("https://other.example.com/api/embed", {
      method: "POST",
      body: "{}",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer test-token");
    expect(calls[1]?.headers.get("Authorization")).toBeNull();
  });
});
