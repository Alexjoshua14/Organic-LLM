import { beforeEach, describe, expect, test } from "bun:test";

import type { SearchFilters, VectorStore, VectorStoreResult } from "mem0ai/oss";

import { EncryptedVectorStore } from "@/lib/memory/encrypted-vector-store";

/** Base64 of 32 bytes (deterministic test IKM k1; not for production). */
const TEST_MEMORY_KEY_K1 = "QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=";

function applyMemoryEncryptionEnv() {
  process.env.MEMORY_ENCRYPTION_CURRENT_KEY = "k1";
  process.env.MEMORY_ENCRYPTION_KEY_K1 = TEST_MEMORY_KEY_K1;
}

/**
 * Minimal in-memory {@link VectorStore} for exercising the encryption wrapper.
 */
class MockVectorStore implements VectorStore {
  private rows = new Map<string, { vector: number[]; payload: Record<string, any> }>();

  async insert(vectors: number[][], ids: string[], payloads: Record<string, any>[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      this.rows.set(ids[i], {
        vector: vectors[i] ?? [],
        payload: { ...payloads[i] },
      });
    }
  }

  async search(
    _query: number[],
    limit = 100,
    _filters?: SearchFilters,
  ): Promise<VectorStoreResult[]> {
    const out: VectorStoreResult[] = [];
    for (const [id, row] of this.rows) {
      if (out.length >= limit) break;
      out.push({
        id,
        payload: { ...row.payload },
        score: 1,
      });
    }
    return out;
  }

  async get(vectorId: string): Promise<VectorStoreResult | null> {
    const row = this.rows.get(vectorId);
    if (!row) return null;
    return { id: vectorId, payload: { ...row.payload } };
  }

  async update(vectorId: string, vector: number[], payload: Record<string, any>): Promise<void> {
    this.rows.set(vectorId, { vector, payload: { ...payload } });
  }

  async delete(vectorId: string): Promise<void> {
    this.rows.delete(vectorId);
  }

  async deleteCol(): Promise<void> {
    this.rows.clear();
  }

  async list(filters?: SearchFilters, limit = 100): Promise<[VectorStoreResult[], number]> {
    const all: VectorStoreResult[] = [];
    for (const [id, row] of this.rows) {
      const p = row.payload;
      if (filters?.user_id && p.user_id !== filters.user_id) continue;
      if (filters?.agent_id && p.agent_id !== filters.agent_id) continue;
      if (filters?.run_id && p.run_id !== filters.run_id) continue;
      all.push({ id, payload: { ...p } });
    }
    return [all.slice(0, limit), all.length];
  }

  async getUserId(): Promise<string> {
    return "mock-user";
  }

  async setUserId(_userId: string): Promise<void> {}

  async initialize(): Promise<void> {}

  /** What was last written at rest (ciphertext for encrypted fields). */
  storedPayload(id: string): Record<string, any> | undefined {
    return this.rows.get(id)?.payload;
  }
}

describe("EncryptedVectorStore", () => {
  let cryptoMod: typeof import("@/lib/crypto/memory-encryption");

  beforeEach(async () => {
    applyMemoryEncryptionEnv();
    cryptoMod = await import("@/lib/crypto/memory-encryption");
    cryptoMod.resetMemoryEncryptionKeyCache();
  });

  test("insert encrypts data and textLemmatized at rest; get returns plaintext", async () => {
    const inner = new MockVectorStore();
    const wrap = new EncryptedVectorStore(inner);

    const plainData = "User prefers dark mode";
    const plainLemma = "user prefer dark mode";

    await wrap.insert([[0.1, 0.2]], ["m1"], [
      {
        data: plainData,
        textLemmatized: plainLemma,
        user_id: "u1",
        hash: "abc",
      },
    ] satisfies Record<string, any>[]);

    const atRest = inner.storedPayload("m1");
    expect(atRest).toBeDefined();
    expect(typeof atRest!.data).toBe("string");
    expect(cryptoMod.isEncrypted(atRest!.data as string)).toBe(true);
    expect(cryptoMod.isEncrypted(atRest!.textLemmatized as string)).toBe(true);
    expect(atRest!.user_id).toBe("u1");
    expect(atRest!.hash).toBe("abc");

    const got = await wrap.get("m1");
    expect(got?.payload.data).toBe(plainData);
    expect(got?.payload.textLemmatized).toBe(plainLemma);
  });

  test("search and list decrypt payloads", async () => {
    const inner = new MockVectorStore();
    const wrap = new EncryptedVectorStore(inner);

    await wrap.insert([[1, 0, 0]], ["a"], [{ data: "alpha", user_id: "u1" }]);
    await wrap.insert([[0, 1, 0]], ["b"], [{ data: "beta", user_id: "u1" }]);

    const searchHits = await wrap.search([1, 0, 0], 10, { user_id: "u1" });
    const texts = searchHits.map((h) => h.payload.data).sort();
    expect(texts).toEqual(["alpha", "beta"]);

    const [listed] = await wrap.list({ user_id: "u1" }, 10);
    expect(listed.map((x) => x.payload.data).sort()).toEqual(["alpha", "beta"]);
  });

  test("update re-encrypts payload fields", async () => {
    const inner = new MockVectorStore();
    const wrap = new EncryptedVectorStore(inner);

    await wrap.insert([[1]], ["x"], [{ data: "first", user_id: "u1" }]);
    await wrap.update("x", [2], { data: "second", user_id: "u1", hash: "h2" });

    expect(cryptoMod.isEncrypted(inner.storedPayload("x")!.data as string)).toBe(true);
    const got = await wrap.get("x");
    expect(got?.payload.data).toBe("second");
    expect(got?.payload.hash).toBe("h2");
  });

  test("legacy plaintext payloads pass through on read", async () => {
    const inner = new MockVectorStore();
    await inner.insert([[1]], ["legacy"], [{ data: "plain-old", user_id: "u1" }]);

    const wrap = new EncryptedVectorStore(inner);
    const got = await wrap.get("legacy");
    expect(got?.payload.data).toBe("plain-old");

    const [listed] = await wrap.list({ user_id: "u1" }, 10);
    expect(listed[0]?.payload.data).toBe("plain-old");
  });

  test("delegates delete, deleteCol, getUserId, setUserId, initialize", async () => {
    const inner = new MockVectorStore();
    const wrap = new EncryptedVectorStore(inner);

    await wrap.initialize();
    await wrap.insert([[1]], ["d"], [{ data: "x", user_id: "u1" }]);
    expect(await wrap.getUserId()).toBe("mock-user");
    await wrap.setUserId("other");
    await wrap.delete("d");
    expect(await wrap.get("d")).toBeNull();
    await wrap.insert([[1]], ["e"], [{ data: "y", user_id: "u1" }]);
    await wrap.deleteCol();
    expect(inner.storedPayload("e")).toBeUndefined();
  });
});
