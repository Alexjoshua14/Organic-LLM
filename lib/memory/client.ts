import "server-only";
import "./install-mem0-ollama-config";
import "./install-mem0-vector-encryption";
import { installMem0OllamaFetch } from "./install-mem0-ollama-fetch";

import { Memory } from "mem0ai/oss";

import { config } from "@/config/mem0-config";

installMem0OllamaFetch();

let memoryInstance: Memory | null = null;

export function getMemory(): Memory {
  if (!memoryInstance) {
    memoryInstance = new Memory(config);
  }

  return memoryInstance;
}

// Export a default getter for backward compatibility
export default getMemory;
