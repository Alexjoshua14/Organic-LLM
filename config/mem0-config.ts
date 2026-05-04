import { MemoryConfig } from "mem0ai/oss";
import { QdrantClient } from "@qdrant/js-client-rest";

import {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";
import { custom_fact_extraction_prompt } from "@/lib/system-prompt/memory";
import "server-only";

const MEMORY_HOST = process.env.MEMORY_API_HOST ?? "localhost";
const MEMORY_PORT = MEMORY_HOST == "localhost" ? 6333 : 443;
const MEMORY_KEY = process.env.MEMORY_API_SECRET;

export {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";

const qdrantClient = new QdrantClient({
  host: MEMORY_HOST,
  port: MEMORY_PORT,
  https: true,
  apiKey: MEMORY_KEY,
});

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
