import { MemoryConfig } from "mem0ai/oss";

import { getMemoryQdrantClient } from "@/config/memory-qdrant-client";
import {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";
import { OLLAMA_EMBED_MODEL, OLLAMA_URL } from "@/lib/memory/ollama-config";
import { custom_fact_extraction_prompt } from "@/lib/system-prompt/memory";
import "server-only";

export {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";

type CreateMem0ConfigOptions = {
  ollamaEmbedModel?: string;
  ollamaUrl?: string;
  qdrantClient?: ReturnType<typeof getMemoryQdrantClient>;
};

export function createMem0Config({
  ollamaEmbedModel = OLLAMA_EMBED_MODEL,
  ollamaUrl = OLLAMA_URL,
  qdrantClient = getMemoryQdrantClient(),
}: CreateMem0ConfigOptions = {}): MemoryConfig {
  return {
    embedder: {
      provider: "ollama",
      config: {
        model: ollamaEmbedModel || MEMORY_PRODUCTION_EMBEDDER_MODEL,
        url: ollamaUrl,
        embeddingDims: MEMORY_PRODUCTION_EMBEDDING_DIMS,
      },
    },
    vectorStore: {
      provider: "qdrant",
      config: {
        collectionName: MEMORY_PRODUCTION_QDRANT_COLLECTION,
        embeddingModelDims: MEMORY_PRODUCTION_EMBEDDING_DIMS,
        dimension: MEMORY_PRODUCTION_EMBEDDING_DIMS,
        client: qdrantClient,
      },
    },
    llm: {
      provider: "openai",
      config: {
        apiKey: process.env.OPENAI_API_KEY || "",
        model: "gpt-5.6-luna",
      },
    },
    customPrompt: custom_fact_extraction_prompt,
  };
}

export const config = createMem0Config();
