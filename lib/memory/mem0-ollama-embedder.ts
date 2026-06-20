import "server-only";

import { createLogger } from "@/lib/logger";

import { OLLAMA_EMBED_MODEL, OLLAMA_URL, isLocalOllamaUrl, ollamaHeaders } from "./ollama-config";

const logger = createLogger("mem0-ollama-embedder");

type Mem0OllamaEmbedderConfig = {
  model?: string;
  url?: string;
  embeddingDims?: number;
};

type OllamaEmbedResponse = {
  embeddings?: number[][];
  embedding?: number[];
  error?: string;
};

type OllamaTagsResponse = {
  models?: Array<{ name: string }>;
};

/**
 * Mem0 embedder that uses {@link OLLAMA_URL} and {@link ollamaHeaders} so remote
 * Ollama proxies (e.g. token-gated tunnels) work for memory ingest/search.
 */
export class Mem0OllamaEmbedder {
  embeddingDims: number | undefined;

  private readonly host: string;
  private readonly model: string;
  private initialized = false;

  constructor(config: Mem0OllamaEmbedderConfig = {}) {
    this.host = (config.url ?? OLLAMA_URL).replace(/\/$/, "");
    this.model = config.model ?? OLLAMA_EMBED_MODEL;
    this.embeddingDims = config.embeddingDims;
  }

  private static normalizeModelName(name: string): string {
    return name.split(":")[0]?.trim() ?? name;
  }

  private embedderError(message: string, cause?: unknown): Error {
    const error = new Error(
      `Mem0 Ollama embedder (${this.host}, model=${this.model}): ${message}`,
    );

    if (cause instanceof Error) {
      error.cause = cause;
    }

    return error;
  }

  private async ensureModelExists(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!isLocalOllamaUrl(this.host)) {
      this.initialized = true;
      return;
    }

    let listRes: Response;

    try {
      listRes = await fetch(`${this.host}/api/tags`, { headers: ollamaHeaders() });
    } catch (error) {
      throw this.embedderError("Could not reach Ollama /api/tags — is OLLAMA_URL correct?", error);
    }

    if (!listRes.ok) {
      throw this.embedderError(`Ollama list models failed: ${listRes.status} ${listRes.statusText}`);
    }

    const data = (await listRes.json()) as OllamaTagsResponse;
    const target = Mem0OllamaEmbedder.normalizeModelName(this.model);
    const found = data.models?.some(
      (entry) => Mem0OllamaEmbedder.normalizeModelName(entry.name) === target,
    );

    if (!found) {
      logger.log("ensureModelExists", `Pulling model ${this.model}...`);
      const pullRes = await fetch(`${this.host}/api/pull`, {
        method: "POST",
        headers: ollamaHeaders(),
        body: JSON.stringify({ name: this.model }),
      });

      if (!pullRes.ok) {
        throw this.embedderError(`Ollama pull failed: ${pullRes.status} ${pullRes.statusText}`);
      }

      await pullRes.text();
    }

    this.initialized = true;
  }

  private async embedApi(input: string | string[]): Promise<number[][]> {
    let res: Response;

    try {
      res = await fetch(`${this.host}/api/embed`, {
        method: "POST",
        headers: ollamaHeaders(),
        body: JSON.stringify({ model: this.model, input }),
      });
    } catch (error) {
      throw this.embedderError("Ollama /api/embed request failed — embedder unreachable", error);
    }

    const data = (await res.json()) as OllamaEmbedResponse;

    if (!res.ok || data.error) {
      throw this.embedderError(`Ollama embed failed: ${data.error ?? res.statusText}`);
    }

    if (Array.isArray(input)) {
      if (data.embeddings?.length) {
        return data.embeddings;
      }

      throw this.embedderError("Ollama batch embed returned no embeddings");
    }

    const vector = data.embeddings?.[0] ?? data.embedding;

    if (!vector) {
      throw this.embedderError("Ollama embed returned no embedding vector");
    }

    return [vector];
  }

  async embed(text: string): Promise<number[]> {
    await this.ensureModelExists();
    const [vector] = await this.embedApi(text);

    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.ensureModelExists();

    return this.embedApi(texts);
  }
}
