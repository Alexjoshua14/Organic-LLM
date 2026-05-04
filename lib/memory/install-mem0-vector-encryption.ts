import type { VectorStore, VectorStoreConfig } from "mem0ai/oss";

import { VectorStoreFactory } from "mem0ai/oss";
import "server-only";

import { EncryptedVectorStore } from "./encrypted-vector-store";

let installed = false;

/**
 * True when {@link MEMORY_ENCRYPTION_CURRENT_KEY} and the matching
 * `MEMORY_ENCRYPTION_KEY_K{n}` env var are set (same contract as {@link encryptMemory}).
 */
export function isMemoryEncryptionConfigured(): boolean {
  const current = process.env.MEMORY_ENCRYPTION_CURRENT_KEY?.trim();

  if (!current || !/^k\d+$/.test(current)) {
    return false;
  }

  const suffix = current.slice(1).toUpperCase();
  const raw = process.env[`MEMORY_ENCRYPTION_KEY_K${suffix}`]?.trim();

  return Boolean(raw && raw.length > 0);
}

/**
 * Wraps every Mem0 `VectorStoreFactory.create` result in {@link EncryptedVectorStore}
 * when memory encryption env is configured (main collection and `{name}_entities`).
 *
 * Coupled to mem0ai internals; an upstream `vectorStoreWrapper` hook would be preferable.
 */
function installMem0VectorStoreEncryption(): void {
  if (installed) {
    return;
  }
  installed = true;

  if (!isMemoryEncryptionConfigured()) {
    return;
  }

  const originalCreate = VectorStoreFactory.create.bind(VectorStoreFactory);

  VectorStoreFactory.create = (provider: string, config: VectorStoreConfig): VectorStore => {
    const store = originalCreate(provider, config);

    return new EncryptedVectorStore(store);
  };
}

installMem0VectorStoreEncryption();
