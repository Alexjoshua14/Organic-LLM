import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

mock.module("@/config/memory-qdrant-client", () => ({
  getMemoryQdrantClient: () => ({}),
}));

/** Stable mock URL — mem0-config should wire this into embedder.config.url. */
const MOCK_OLLAMA_URL = "https://ollama.example.com";

mock.module("@/lib/memory/ollama-config", () => ({
  OLLAMA_URL: MOCK_OLLAMA_URL,
  OLLAMA_API_KEY: undefined,
  OLLAMA_EMBED_MODEL: "nomic-embed-text",
  isLocalOllamaUrl: () => false,
  ollamaHeaders: () => ({ "Content-Type": "application/json" }),
}));

describe("mem0-config embedder", () => {
  test("uses OLLAMA_URL for the Mem0 Ollama embedder", async () => {
    const { config } = await import("@/config/mem0-config");

    expect(config.embedder.config.url).toBe(MOCK_OLLAMA_URL);
    expect(config.embedder.config.embeddingDims).toBe(768);
  });
});

describe("installMem0OllamaFetch", () => {
  test("adds Authorization for requests to OLLAMA_URL", async () => {
    process.env.OLLAMA_URL = "https://ollama.example.com";
    process.env.OLLAMA_API_KEY = "test-token";

    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; headers: Headers }> = [];

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );

      calls.push({ url, headers });

      return new Response(JSON.stringify({ embeddings: [[0.1]] }), { status: 200 });
    };

    const { installMem0OllamaFetch } = await import("@/lib/memory/install-mem0-ollama-fetch");

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

    globalThis.fetch = originalFetch;
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OLLAMA_URL;
  });
});
