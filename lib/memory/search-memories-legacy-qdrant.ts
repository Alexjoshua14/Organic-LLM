import "server-only";

import { QdrantClient } from "@qdrant/js-client-rest";

import {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";

const MEMORY_HOST = process.env.MEMORY_API_HOST ?? "localhost";
const MEMORY_PORT = MEMORY_HOST === "localhost" ? 6333 : 443;
const MEMORY_KEY = process.env.MEMORY_API_SECRET;

const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");

function createQdrantClient(): QdrantClient {
  return new QdrantClient({
    host: MEMORY_HOST,
    port: MEMORY_PORT,
    https: true,
    apiKey: MEMORY_KEY,
  });
}

function payloadUserId(payload: Record<string, unknown>): string | undefined {
  const u = payload.userId ?? payload.user_id;
  return typeof u === "string" && u.length > 0 ? u : undefined;
}

async function embedLegacyQuery(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MEMORY_PRODUCTION_EMBEDDER_MODEL, input: text }),
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
  if (vec.length !== MEMORY_PRODUCTION_EMBEDDING_DIMS) {
    throw new Error(
      `Legacy embed dim mismatch: got ${vec.length}, expected ${MEMORY_PRODUCTION_EMBEDDING_DIMS}`
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

  const client = createQdrantClient();
  const retrieved = await client.retrieve(MEMORY_PRODUCTION_QDRANT_COLLECTION, {
    ids: [memoryPointId],
    with_payload: true,
    with_vector: true,
  });

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
