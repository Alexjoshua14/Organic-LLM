import type { EmbeddingConfig } from "mem0ai/oss";

import { EmbedderFactory } from "mem0ai/oss";
import "server-only";

import { Mem0OllamaEmbedder } from "./mem0-ollama-embedder";

let installed = false;

/**
 * Replaces Mem0's built-in Ollama embedder (localhost-only, no auth headers) with
 * {@link Mem0OllamaEmbedder}, which reads `OLLAMA_URL` / `OLLAMA_API_KEY`.
 *
 * Coupled to mem0ai internals; an upstream embedder `headers` option would be preferable.
 */
function installMem0OllamaConfig(): void {
  if (installed) {
    return;
  }
  installed = true;

  const originalCreate = EmbedderFactory.create.bind(EmbedderFactory);

  EmbedderFactory.create = (provider: string, config: EmbeddingConfig) => {
    if (provider === "ollama") {
      return new Mem0OllamaEmbedder(config);
    }

    return originalCreate(provider, config);
  };
}

installMem0OllamaConfig();
