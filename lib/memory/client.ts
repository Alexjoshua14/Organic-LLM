import "server-only";
import "./install-mem0-vector-encryption";

import { Memory } from "mem0ai/oss";

import { config } from "@/config/mem0-config";

let memoryInstance: Memory | null = null;

export function getMemory(): Memory {
  if (!memoryInstance) {
    memoryInstance = new Memory(config);
  }

  return memoryInstance;
}

// Export a default getter for backward compatibility
export default getMemory;
