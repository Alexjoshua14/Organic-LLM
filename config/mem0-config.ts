import { MemoryConfig } from "mem0ai/oss";

import { getMemoryQdrantClient } from "@/config/memory-qdrant-client";
import {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";
import { custom_fact_extraction_prompt } from "@/lib/system-prompt/memory";
import "server-only";

export {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";

const qdrantClient = getMemoryQdrantClient();

export const config: MemoryConfig = {
  embedder: {
    provider: "ollama",
    config: {
      model: MEMORY_PRODUCTION_EMBEDDER_MODEL,
      url: "http://localhost:11434",
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
      model: "gpt-5.4-nano",
    },
  },
  customPrompt: custom_fact_extraction_prompt,
};
