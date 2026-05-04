import { MemoryConfig } from "mem0ai/oss";
import { QdrantClient } from "@qdrant/js-client-rest";

import { custom_fact_extraction_prompt } from "@/lib/system-prompt/memory";
import "server-only";

const MEMORY_HOST = process.env.MEMORY_API_HOST ?? "localhost";
const MEMORY_PORT = MEMORY_HOST == "localhost" ? 6333 : 443;
const MEMORY_KEY = process.env.MEMORY_API_SECRET;

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
      model: "all-minilm",
      url: "http://localhost:11434",
    },
  },
  vectorStore: {
    provider: "qdrant",
    config: {
      collectionName: "memories",
      embeddingModelDims: 384,
      dimension: 384,
      client: qdrantClient,
    },
  },
  llm: {
    provider: "openai",
    config: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-5-mini",
    },
  },
  customPrompt: custom_fact_extraction_prompt,
};
