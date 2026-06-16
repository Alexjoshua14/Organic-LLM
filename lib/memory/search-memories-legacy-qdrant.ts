import "server-only";

import type { MemoryItemType } from "@/lib/schemas/memory";

import {
  MEMORY_LEGACY_EMBEDDING_DIMS,
  MEMORY_LEGACY_EMBEDDER_MODEL,
  MEMORY_LEGACY_QDRANT_COLLECTION,
} from "@/config/memory-legacy-meta";
import { getMemoryQdrantClient } from "@/config/memory-qdrant-client";
import { decryptMemory, isEncrypted } from "@/lib/crypto/memory-encryption";
import { OLLAMA_URL, ollamaHeaders } from "@/lib/memory/ollama-config";
import { runMemoryStore } from "@/lib/memory/run-memory-store";

function payloadUserId(payload: Record<string, unknown>): string | undefined {
  const u = payload.userId ?? payload.user_id;

  return typeof u === "string" && u.length > 0 ? u : undefined;
}

function decryptDataField(raw: string): string {
  if (!raw || !raw.trim()) {
    return "";
  }
  if (isEncrypted(raw)) {
    return decryptMemory(raw);
  }

  return raw;
}

async function embedLegacyQuery(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify({ model: MEMORY_LEGACY_EMBEDDER_MODEL, input: text }),
  });
  const data = (await res.json()) as {
    embeddings?: number[][];
    embedding?: number[];
    error?: string;
  };

  if (!res.ok || data.error) {
    throw new Error(data.error ?? res.statusText);
  }
  const vec = data.embeddings?.[0] ?? data.embedding;

  if (!vec?.length) {
    throw new Error("Unexpected Ollama embed response shape");
  }
  if (vec.length !== MEMORY_LEGACY_EMBEDDING_DIMS) {
    throw new Error(
      `Legacy embed dim mismatch: got ${vec.length}, expected ${MEMORY_LEGACY_EMBEDDING_DIMS}`
    );
  }

  return vec;
}

function dot(a: number[], b: number[]): number {
  let s = 0;

  for (let i = 0; i < a.length; i++) {
    s += a[i]! * b[i]!;
  }

  return s;
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Cosine similarity in [-1, 1], same sign as Qdrant Cosine distance score for normalized vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);

  if (na === 0 || nb === 0) return 0;

  return dot(a, b) / (na * nb);
}

function extractVector(raw: unknown): number[] | null {
  if (Array.isArray(raw) && raw.every((x) => typeof x === "number")) {
    return raw as number[];
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o);

    if (keys.length === 1 && Array.isArray(o[keys[0]!])) {
      const inner = o[keys[0]!] as unknown[];

      if (inner.every((x) => typeof x === "number")) {
        return inner as number[];
      }
    }
    const def = o.default;

    if (Array.isArray(def) && def.every((x) => typeof x === "number")) {
      return def as number[];
    }
  }

  return null;
}

/**
 * Semantic search against legacy Qdrant `memories` (Mem0-style one point per memory).
 * Uses {@link MEMORY_LEGACY_EMBEDDER_MODEL} / dims — not production Mem0 config after v2 cutover.
 */
export async function searchMemoriesLegacyFromQdrant(
  query: string,
  userId: string,
  limit: number
): Promise<{ results: MemoryItemType[]; queryVector: number[] }> {
  if (!userId) {
    throw new Error("User ID is required");
  }
  if (!query.trim()) {
    return { results: [], queryVector: [] };
  }

  const client = getMemoryQdrantClient();
  const vector = await embedLegacyQuery(query);

  const hits = await runMemoryStore("searchMemoriesLegacyFromQdrant", () =>
    client.search(MEMORY_LEGACY_QDRANT_COLLECTION, {
      vector,
      limit: Math.max(1, limit),
      with_payload: true,
      filter: {
        should: [
          { key: "userId", match: { value: userId } },
          { key: "user_id", match: { value: userId } },
        ],
      },
    })
  );

  const results: MemoryItemType[] = [];

  for (const hit of hits) {
    const payload = (hit.payload ?? {}) as Record<string, unknown>;

    if (payloadUserId(payload) !== userId) {
      continue;
    }
    const rawData = payload.data;
    const dataStr = typeof rawData === "string" ? rawData : "";
    const memoryText = decryptDataField(dataStr).trim();

    if (!memoryText) {
      continue;
    }
    const id = String(hit.id);
    const score = typeof hit.score === "number" ? hit.score : undefined;
    const hash = typeof payload.hash === "string" ? payload.hash : undefined;
    const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : undefined;

    results.push({
      id,
      memory: memoryText,
      hash,
      createdAt,
      score,
    });
  }

  return { results, queryVector: vector };
}

/**
 * Best cosine score for a specific legacy memory point vs query embedding, if the point exists
 * in Qdrant `memories` and belongs to `userId` (payload `user_id` / `userId`).
 */
export async function getBestLegacyPointScoreForMemoryId(
  queryVector: number[],
  userId: string,
  memoryPointId: string
): Promise<number | null> {
  if (queryVector.length === 0 || !userId || !memoryPointId) {
    return null;
  }

  const client = getMemoryQdrantClient();
  const retrieved = await runMemoryStore("getBestLegacyPointScoreForMemoryId", () =>
    client.retrieve(MEMORY_LEGACY_QDRANT_COLLECTION, {
      ids: [memoryPointId],
      with_payload: true,
      with_vector: true,
    })
  );

  if (!retrieved.length) {
    return null;
  }

  const point = retrieved[0]!;
  const payload = (point.payload ?? {}) as Record<string, unknown>;

  if (payloadUserId(payload) !== userId) {
    return null;
  }

  const stored = extractVector(point.vector);

  if (!stored || stored.length !== queryVector.length) {
    return null;
  }

  return cosineSimilarity(queryVector, stored);
}

export async function embedLegacyQueryForMarginalSearch(query: string): Promise<number[]> {
  const q = query.trim();

  if (!q) {
    return [];
  }

  return embedLegacyQuery(q);
}
