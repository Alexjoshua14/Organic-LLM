import "server-only";

import { cloudflareAccessHeaders } from "../cloudflare-access";

let installed = false;

function readOllamaUrl(): string {
  return (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;

  return input.url;
}

/**
 * Mem0's Ollama embedder uses the `ollama` npm client, which does not read
 * `OLLAMA_API_KEY`. When Ollama is behind the authenticated tunnel, inject the
 * bearer token and any Cloudflare Access service-token headers on fetch calls to `OLLAMA_URL`
 * before Mem0 is constructed.
 */
export function installMem0OllamaFetch(): void {
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  const accessHeaders = cloudflareAccessHeaders("ollama");

  if (installed || (!apiKey && Object.keys(accessHeaders).length === 0)) {
    return;
  }

  installed = true;

  const ollamaUrl = readOllamaUrl();
  const originalFetch = globalThis.fetch;
  const ollamaPrefix = `${ollamaUrl}/`;

  const patchedFetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input);

      if (!url.startsWith(ollamaPrefix) && !url.startsWith(ollamaUrl)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );

      if (apiKey && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${apiKey}`);
      }

      for (const [name, value] of Object.entries(accessHeaders)) {
        if (!headers.has(name)) headers.set(name, value);
      }

      return originalFetch(input, { ...init, headers });
    },
    originalFetch
  ) as typeof fetch;

  globalThis.fetch = patchedFetch;
}
