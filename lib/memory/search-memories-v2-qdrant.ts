import "server-only";

import type { MemoryItemType } from "@/lib/schemas/memory";

import { decryptMemory, isEncrypted } from "@/lib/crypto/memory-encryption";
import { OLLAMA_URL, ollamaHeaders } from "@/lib/memory/ollama-config";
import { createQdrantClient } from "@/lib/memory/qdrant-config";
import { runMemoryStore } from "@/lib/memory/run-memory-store";

const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const V2_COLLECTION = process.env.MEMORY_V2_COLLECTION ?? "memories_v2";

function decryptDataField(raw: string): string {
  if (!raw || !raw.trim()) {
    return "";
  }
  if (isEncrypted(raw)) {
    return decryptMemory(raw);
  }
  return raw;
}

function payloadUserId(payload: Record<string, unknown>): string | undefined {
  const u = payload.userId ?? payload.user_id;
  return typeof u === "string" && u.length > 0 ? u : undefined;
}

let cachedEmbeddingDims: number | null = null;

async function probeEmbeddingDims(model: string): Promise<number> {
  const dimsEnv = process.env.MEMORY_V2_EMBEDDING_DIMS?.trim();
  if (dimsEnv) {
    const n = parseInt(dimsEnv, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify({ model, input: "probe" }),
  });
  const data = (await res.json()) as {
    embeddings?: number[][];
    embedding?: number[];
    error?: string;
  };
  if (!res.ok || data.error) {
    throw new Error(`Ollama embed probe failed: ${data.error ?? res.statusText}`);
  }
  const dim = data.embeddings?.[0]?.length ?? data.embedding?.length;
  if (!dim) {
    throw new Error("Could not determine embedding dimensions from Ollama response");
  }
  return dim;
}

async function embedQuery(model: string, text: string): Promise<number[]> {
  if (cachedEmbeddingDims === null) {
    cachedEmbeddingDims = await probeEmbeddingDims(model);
  }

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify({ model, input: text }),
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
  if (vec.length !== cachedEmbeddingDims) {
    throw new Error(
      `Embedding dim mismatch: got ${vec.length}, expected ${cachedEmbeddingDims} (set MEMORY_V2_EMBEDDING_DIMS if needed)`
    );
  }

  return vec;
}

type ChunkAgg = {
  sourceMemoryId: string;
  bestScore: number;
  chunks: { chunkIndex: number; text: string }[];
  createdAt?: string;
  hash?: string;
};

/**
 * Semantic search against Qdrant `memories_v2` (migration chunks), same contracts as
 * `scripts/migrate-memories-v2.ts`: Ollama embed model, optional encrypted `data` payloads.
 */
export async function getBestV2ChunkScoreForSourceMemory(
  queryVector: number[],
  userId: string,
  sourceMemoryId: string
): Promise<number | null> {
  if (queryVector.length === 0 || !userId || !sourceMemoryId) {
    return null;
  }
  const client = createQdrantClient();
  const hits = await runMemoryStore("getBestV2ChunkScoreForSourceMemory", () =>
    client.search(V2_COLLECTION, {
      vector: queryVector,
      limit: 1,
      with_payload: false,
      filter: {
        must: [
          { key: "userId", match: { value: userId } },
          { key: "sourceMemoryId", match: { value: sourceMemoryId } },
        ],
      },
    })
  );
  if (!hits.length) return null;
  const s = hits[0]!.score;
  return typeof s === "number" ? s : null;
}

export async function searchMemoriesV2FromQdrant(
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

  const client = createQdrantClient();
  const vector = await embedQuery(OLLAMA_EMBED_MODEL, query);

  const chunkFetchLimit = Math.min(200, Math.max(limit * 25, limit));

  const hits = await runMemoryStore("searchMemoriesV2FromQdrant", () =>
    client.search(V2_COLLECTION, {
      vector,
      limit: chunkFetchLimit,
      with_payload: true,
      filter: {
        must: [{ key: "userId", match: { value: userId } }],
      },
    })
  );

  const bySource = new Map<string, ChunkAgg>();

  for (const hit of hits) {
    const payload = (hit.payload ?? {}) as Record<string, unknown>;
    if (payloadUserId(payload) !== userId) {
      continue;
    }
    const rawSource = payload.sourceMemoryId;
    const sourceMemoryId = typeof rawSource === "string" ? rawSource : "";
    if (!sourceMemoryId) {
      continue;
    }
    const rawData = payload.data;
    const dataStr = typeof rawData === "string" ? rawData : "";
    const chunkPlain = decryptDataField(dataStr).trim();
    if (!chunkPlain) {
      continue;
    }
    const idxRaw = payload.chunkIndex;
    const chunkIndex =
      typeof idxRaw === "number" && Number.isFinite(idxRaw) ? Math.floor(idxRaw) : 0;
    const score = typeof hit.score === "number" ? hit.score : 0;

    let agg = bySource.get(sourceMemoryId);
    if (!agg) {
      agg = {
        sourceMemoryId,
        bestScore: score,
        chunks: [],
        hash: typeof payload.hash === "string" ? payload.hash : undefined,
        createdAt: typeof payload.createdAt === "string" ? payload.createdAt : undefined,
      };
      bySource.set(sourceMemoryId, agg);
    }
    agg.bestScore = Math.max(agg.bestScore, score);
    agg.chunks.push({ chunkIndex, text: chunkPlain });
  }

  const memories: MemoryItemType[] = [];

  for (const agg of bySource.values()) {
    agg.chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const memory = agg.chunks.map((c) => c.text).join("\n\n");
    memories.push({
      id: agg.sourceMemoryId,
      memory,
      hash: agg.hash,
      createdAt: agg.createdAt,
      score: agg.bestScore,
    });
  }

  memories.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const top = memories.slice(0, Math.max(1, limit));

  return { results: top, queryVector: vector };
}
