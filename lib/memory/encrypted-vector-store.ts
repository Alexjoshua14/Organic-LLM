import type { SearchFilters, VectorStore, VectorStoreResult } from "mem0ai/oss";

import { decryptMemory, encryptMemory, isEncrypted } from "@/lib/crypto/memory-encryption";

function encryptPayloadFields(payload: Record<string, any>): Record<string, any> {
  const out = { ...payload };

  if (typeof out.data === "string" && !isEncrypted(out.data)) {
    out.data = encryptMemory(out.data);
  }
  if (typeof out.textLemmatized === "string" && !isEncrypted(out.textLemmatized)) {
    out.textLemmatized = encryptMemory(out.textLemmatized);
  }

  return out;
}

function decryptPayloadFields(payload: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {
    ...payload,
    reference_count: referenceCount(payload.reference_count),
  };

  if (typeof out.data === "string" && isEncrypted(out.data)) {
    out.data = decryptMemory(out.data);
  }
  if (typeof out.textLemmatized === "string" && isEncrypted(out.textLemmatized)) {
    out.textLemmatized = decryptMemory(out.textLemmatized);
  }

  return out;
}

function referenceCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function decryptResult(result: VectorStoreResult): VectorStoreResult {
  return {
    ...result,
    payload: decryptPayloadFields(result.payload ?? {}),
  };
}

type InnerWithKeywordSearch = VectorStore & {
  keywordSearch?: (
    query: string,
    topK?: number,
    filters?: SearchFilters
  ) => Promise<Array<{ id: string; payload: Record<string, unknown>; score?: number }> | null>;
};

/**
 * Wraps a Mem0 OSS {@link VectorStore} so `data` and `textLemmatized` payload fields are
 * encrypted at rest when configured. Embeddings are unchanged. Also initializes and
 * preserves the reserved reference_count field; reads never increment it.
 */
export class EncryptedVectorStore implements VectorStore {
  constructor(
    private readonly inner: VectorStore,
    private readonly encryptAtRest = true
  ) {}

  async insert(vectors: number[][], ids: string[], payloads: Record<string, any>[]): Promise<void> {
    const encrypted = payloads.map((p) => {
      const payload = { ...p, reference_count: 0 };

      return this.encryptAtRest ? encryptPayloadFields(payload) : payload;
    });

    await this.inner.insert(vectors, ids, encrypted);
  }

  async search(
    query: number[],
    limit?: number,
    filters?: SearchFilters
  ): Promise<VectorStoreResult[]> {
    const hits = await this.inner.search(query, limit, filters);

    return hits.map(decryptResult);
  }

  async get(vectorId: string): Promise<VectorStoreResult | null> {
    const row = await this.inner.get(vectorId);

    if (!row) return null;

    return decryptResult(row);
  }

  async update(vectorId: string, vector: number[], payload: Record<string, any>): Promise<void> {
    // Mem0 replaces payloads on text updates and omits custom fields. Preserve the counter.
    const previous = await this.inner.get(vectorId);
    const next = { ...payload, reference_count: referenceCount(previous?.payload.reference_count) };

    await this.inner.update(
      vectorId,
      vector,
      this.encryptAtRest ? encryptPayloadFields(next) : next
    );
  }

  async delete(vectorId: string): Promise<void> {
    await this.inner.delete(vectorId);
  }

  async deleteCol(): Promise<void> {
    await this.inner.deleteCol();
  }

  async list(filters?: SearchFilters, limit?: number): Promise<[VectorStoreResult[], number]> {
    const [rows, n] = await this.inner.list(filters, limit);

    return [rows.map(decryptResult), n];
  }

  async getUserId(): Promise<string> {
    return this.inner.getUserId();
  }

  async setUserId(userId: string): Promise<void> {
    await this.inner.setUserId(userId);
  }

  async initialize(): Promise<void> {
    await this.inner.initialize();
  }

  /**
   * Mem0 calls this when present for BM25 fusion; decrypt payloads on the way out.
   */
  async keywordSearch(
    query: string,
    topK?: number,
    filters?: SearchFilters
  ): Promise<Array<{ id: string; payload: Record<string, unknown>; score?: number }> | null> {
    const inner = this.inner as InnerWithKeywordSearch;

    if (typeof inner.keywordSearch !== "function") {
      return null;
    }
    const raw = await inner.keywordSearch(query, topK, filters);

    if (!raw) return null;

    return raw.map((hit) => ({
      ...hit,
      payload: decryptPayloadFields((hit.payload ?? {}) as Record<string, any>),
    }));
  }
}
