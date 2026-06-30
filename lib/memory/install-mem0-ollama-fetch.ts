import "server-only";

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
 * bearer token on fetch calls to `OLLAMA_URL` before Mem0 is constructed.
 */
export function installMem0OllamaFetch(): void {
  const apiKey = process.env.OLLAMA_API_KEY?.trim();

  if (installed || !apiKey) {
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

      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${apiKey}`);
      }

      return originalFetch(input, { ...init, headers });
    },
    originalFetch
  ) as typeof fetch;

  globalThis.fetch = patchedFetch;
}
