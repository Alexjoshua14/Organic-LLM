#!/usr/bin/env bun
/**
 * Migrate legacy Qdrant `memories` → encrypted chunks in `memories_v2` with nomic-embed-text vectors.
 *
 * Usage:
 *   MEMORY_API_HOST=… MEMORY_API_SECRET=… OPENAI_API_KEY=… bun run scripts/migrate-memories-v2.ts [--dry-run] [--limit N] [--verification]
 *
 * Inject a single plaintext memory (no legacy scroll, no LLM quality gate):
 *   MEMORY_API_HOST=… MEMORY_API_SECRET=… MIGRATE_MEMORY_USER_ID=<supabase-user-uuid> \\
 *     bun run scripts/migrate-memories-v2.ts --memory "Your memory text here" [--dry-run] [--verification]
 *
 * `--memory` uses the same chunk → Ollama embed → encrypt payload path as the migrator. `sourceMemoryId` is
 * deterministic from `MIGRATE_MEMORY_USER_ID` + content hash so re-running upserts the same chunk ids.
 * `migratedFromCollection` is `manual-inject` (override with MIGRATE_MANUAL_FROM_COLLECTION).
 *
 * `--verification` implies `--dry-run` (no Qdrant writes), defaults `--limit` to 3 unless you pass `--limit`.
 * Runs extra checks (v2 payload encryption shape + round-trip when keys are set, UUID chunk ids) and prints a
 * verification table; exits with code 1 if any check fails.
 *
 * Optional: MEMORY_ENCRYPTION_* (encrypt chunk payloads), OLLAMA_URL, OLLAMA_EMBED_MODEL=nomic-embed-text,
 * MEMORY_V2_COLLECTION=memories_v2, MEMORY_V2_EMBEDDING_DIMS (defaults to probing /api/embed).
 *
 * At exit: prints all LLM-dropped (bad) memories (one per line), then metrics (counts, timing, ~bytes written).
 *
 * OpenAI classification uses Responses API options with `store: false` so requests are not persisted server-side
 * (ZDR-aligned; requires an org/key eligible for non-stored usage per OpenAI policy).
 */

import type { QdrantClient } from "@qdrant/js-client-rest";

import { createHash } from "node:crypto";

import { v5 as uuidv5 } from "uuid";
import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import { getMemoryQdrantClient } from "@/config/memory-qdrant-client";
import { decryptMemory, encryptMemory, isEncrypted } from "@/lib/crypto/memory-encryption";
import {
  chunkMemoryText,
  isMemoryEncryptionEnvConfigured,
  migrateMemoryChunkDefaults,
  v2ChunkPointId,
} from "@/lib/memory/migrate-memories-v2-helpers";

import pLimit from "p-limit";

const LEGACY_COLLECTION = process.env.MEMORY_LEGACY_COLLECTION ?? "memories";
const V2_COLLECTION = process.env.MEMORY_V2_COLLECTION ?? "memories_v2";
const OLLAMA_URL = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const SCROLL_PAGE_SIZE = Math.min(
  256,
  parseInt(process.env.MIGRATE_SCROLL_LIMIT ?? "256", 10) || 256
);
const EMBED_BATCH_MAX = Math.min(64, parseInt(process.env.MIGRATE_EMBED_BATCH ?? "32", 10) || 32);

const CLASSIFY_CONCURRENCY = Math.min(
  50,
  Math.max(1, parseInt(process.env.MIGRATE_CLASSIFY_CONCURRENCY ?? "20", 10) || 20)
);

/** UUID namespace for deterministic `sourceMemoryId` in `--memory` inject mode (RFC 4122 name-based v5). */
const MANUAL_INJECT_SOURCE_ID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const MANUAL_INJECT_FROM_COLLECTION =
  process.env.MIGRATE_MANUAL_FROM_COLLECTION?.trim() || "manual-inject";

const qualityModel = openai(process.env.MIGRATE_QUALITY_MODEL ?? "gpt-5.4-mini");

const MemoryQualitySchema = z.object({
  decision: z.enum(["keep", "drop"]),
  reason: z.string().optional(),
});

type MemoryQuality = z.infer<typeof MemoryQualitySchema>;

/**
 * Some models return a JSON Schema envelope (`{ type, properties }`) instead of the instance.
 * Parse raw model text and validate with {@link MemoryQualitySchema}.
 */
function parseMemoryQualityFromModelText(raw: string): MemoryQuality | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const o = parsed as Record<string, unknown>;
  let candidate: unknown = o;

  if (o.type === "object" && o.properties && typeof o.properties === "object") {
    candidate = o.properties;
  }

  const r = MemoryQualitySchema.safeParse(candidate);

  return r.success ? r.data : null;
}

type ParsedCli = {
  dryRun: boolean;
  limit: number | undefined;
  verification: boolean;
  /** Raw plaintext for inject mode (not trimmed). */
  memoryPlaintext: string | undefined;
  /** True when user passed `--limit N` (not the verification default). */
  explicitLimit: boolean;
};

function parseArgs(argv: string[]): ParsedCli {
  let dryRun = false;
  let verification = false;
  let limit: number | undefined;
  let explicitLimit = false;
  let memoryPlaintext: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--verification") {
      verification = true;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--limit") {
      const n = parseInt(argv[i + 1] ?? "", 10);

      if (!Number.isFinite(n) || n < 1) {
        throw new Error("--limit requires a positive integer");
      }
      limit = n;
      explicitLimit = true;
      i++;
    } else if (a === "--memory") {
      const next = argv[i + 1];

      if (!next || next.startsWith("-")) {
        throw new Error('--memory requires a value: next argv or use --memory="..."');
      }
      memoryPlaintext = next;
      i++;
    } else if (a.startsWith("--memory=")) {
      memoryPlaintext = a.slice("--memory=".length);
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (memoryPlaintext !== undefined && explicitLimit) {
    throw new Error(
      "Do not combine --memory with --limit (inject mode does not scroll legacy rows)"
    );
  }

  if (verification) {
    dryRun = true;
    if (!explicitLimit) {
      limit = 3;
    }
  }

  return { dryRun, limit, verification, memoryPlaintext, explicitLimit };
}

/** Loose RFC-4122 UUID string check (8-4-4-4-12 hex). */
function isUuidShape(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function payloadUserId(payload: Record<string, unknown>): string | undefined {
  const u = payload.userId ?? payload.user_id;

  return typeof u === "string" && u.length > 0 ? u : undefined;
}

function isMigrated(payload: Record<string, unknown>): boolean {
  return payload.migrated_to_v2 === true;
}

function md5Hex(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

function storeDataField(plaintextChunk: string): string {
  if (isMemoryEncryptionEnvConfigured()) {
    return encryptMemory(plaintextChunk);
  }

  return plaintextChunk;
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
    headers: { "Content-Type": "application/json" },
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

type EmbedBatchTiming = { textCount: number; ms: number };

async function embedTexts(
  model: string,
  texts: string[],
  onBatch?: (t: EmbedBatchTiming) => void
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const tryBatch = async (batch: string[]): Promise<number[][]> => {
    const t0 = performance.now();
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: batch }),
    });
    const data = (await res.json()) as {
      embeddings?: number[][];
      embedding?: number[];
      error?: string;
    };

    if (!res.ok || data.error) {
      throw new Error(data.error ?? res.statusText);
    }
    const ms = performance.now() - t0;

    onBatch?.({ textCount: batch.length, ms });
    if (data.embeddings && Array.isArray(data.embeddings)) {
      return data.embeddings;
    }
    if (data.embedding && batch.length === 1) {
      return [data.embedding];
    }
    throw new Error("Unexpected Ollama embed response shape");
  };

  if (texts.length === 1) {
    return tryBatch(texts);
  }

  try {
    return await tryBatch(texts);
  } catch {
    const out: number[][] = [];

    for (const t of texts) {
      out.push(...(await embedTexts(model, [t], onBatch)));
    }

    return out;
  }
}

/** Embed in sub-batches of at most `maxBatch` strings; falls back per-string on batch failure. */
async function embedTextsBatched(
  model: string,
  texts: string[],
  maxBatch: number,
  onBatch?: (t: EmbedBatchTiming) => void
): Promise<number[][]> {
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += maxBatch) {
    const slice = texts.slice(i, i + maxBatch);
    const emb = await embedTexts(model, slice, onBatch);

    out.push(...emb);
  }

  return out;
}

/** Nearest-rank p-quantile on a copied sorted array (p in (0,1]). */
function quantileMs(samples: number[], p: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const s = [...samples].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1));

  return s[idx]!;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KiB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

/** Monospace table: indented title, full-width rule, then `label` + value column (values right-aligned). */
function logMetricTable(title: string, rows: { k: string; v: string }[], rulerWidth = 64): void {
  if (rows.length === 0) {
    return;
  }
  const labelW = Math.max(...rows.map((r) => r.k.length), 1);
  const valueW = Math.max(...rows.map((r) => r.v.length), 1);
  const inner = labelW + 2 + valueW;
  const ruleLen = Math.max(rulerWidth, inner);

  console.log(`\n  ${title}`);
  console.log(`  ${"-".repeat(ruleLen)}`);
  for (const { k, v } of rows) {
    console.log(`  ${k.padEnd(labelW)}  ${v.padStart(valueW)}`);
  }
}

function estimatePayloadBytes(payload: Record<string, unknown>): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8");
  } catch {
    return 0;
  }
}

function singleLineForLog(text: string, maxLen = 2000): string {
  return text.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

async function classifyMemory(
  text: string,
  onLatencyMs?: (ms: number) => void
): Promise<MemoryQuality> {
  const t0 = performance.now();

  try {
    const { object } = await generateObject({
      model: qualityModel,
      schema: MemoryQualitySchema,
      maxOutputTokens: 300,
      providerOptions: {
        openai: {
          store: false,
        } satisfies OpenAIResponsesProviderOptions,
      },
      system: `You filter stored "memory" facts for a personal AI assistant.

Output a single JSON object only, with exactly these keys:
  "decision": either the string "keep" or the string "drop"
  "reason": optional short string

Do not output JSON Schema metadata: no "type", "properties", "$schema", or nested schema objects. Example of correct output:
{"decision":"drop","reason":"Generic fragment with no user-specific fact."}

KEEP (keep) memories that are durable, user-specific preferences or facts about the user/project — things worth retrieving later.

DROP (drop): placeholders like [] or empty shells; meta lines about ML types without substance; trivial fragments ("Latency tells you how fast"); standalone homework/read intentions ("I will read the note tomorrow"); generic definitions with no user linkage; assistant-task staging ("User asked the assistant to choose…") unless it clearly records a durable user decision.

Examples — DROP:
- []
- ML type: ML integrator
- Latency tells you 'how fast'.
- I will read the Obsidian note tomorrow.
- User asked the assistant to choose the state management solution.

Examples — KEEP:
- User is interested in backend trace APIs that feed the UI.
- Organic LLM treats spoken output as a first-class pipeline rather than an afterthought.
- User prefers skipping introductory rationale when learning T3 patterns.`,
      prompt: `Classify this memory line:\n\n${text.slice(0, 8000)}`,
    });

    return object;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err) && typeof err.text === "string") {
      const repaired = parseMemoryQualityFromModelText(err.text);

      if (repaired) {
        logProc("classify", "repaired JSON-schema-shaped reply (parse fallback)", "warn");

        return repaired;
      }
    }
    throw err;
  } finally {
    onLatencyMs?.(performance.now() - t0);
  }
}

async function ensureV2Collection(client: QdrantClient, size: number): Promise<void> {
  try {
    await client.createCollection(V2_COLLECTION, {
      vectors: { size, distance: "Cosine" },
    });
    logProc("qdrant", `created collection  ${V2_COLLECTION}  dim=${size}`);
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;

    if (status !== 409) {
      throw e;
    }
    const info = await client.getCollection(V2_COLLECTION);
    const params = info.config?.params?.vectors;
    const existingSize =
      params && typeof params === "object" && "size" in params
        ? (params as { size: number }).size
        : (info.config?.params?.vectors as { default?: { size?: number } } | undefined)?.default
            ?.size;

    if (existingSize !== undefined && existingSize !== size) {
      throw new Error(
        `Collection ${V2_COLLECTION} exists with vector size ${existingSize}, expected ${size}`
      );
    }
  }
}

type Counters = {
  skippedAlreadyMigrated: number;
  /** Legacy rows considered this run (not already migrated_to_v2). */
  eligibleSeen: number;
  handled: number;
  filtered: number;
  empty: number;
  failed: number;
  chunksWritten: number;
  /** Memories that passed the LLM gate (decision === keep), including those that failed later. */
  classifiedGood: number;
  /** Memories written to v2 (full path completed without error). */
  migratedSuccessful: number;
};

/** Column widths for monospace progress rows (numbers right-aligned). */
const PROGRESS_W = {
  phase: 7,
  handled: 7,
  eligible: 8,
  skipped: 7,
  keep: 5,
  drop: 5,
  empty: 5,
  migOK: 6,
  fail: 5,
  chunks: 6,
  dt_s: 7,
} as const;

function logProgressHeader(): void {
  const w = PROGRESS_W;
  const labels =
    `  ${"phase".padEnd(w.phase)} ` +
    `${"handled".padStart(w.handled)} ` +
    `${"eligible".padStart(w.eligible)} ` +
    `${"skipped".padStart(w.skipped)} ` +
    `${"keep".padStart(w.keep)} ` +
    `${"drop".padStart(w.drop)} ` +
    `${"empty".padStart(w.empty)} ` +
    `${"migOK".padStart(w.migOK)} ` +
    `${"fail".padStart(w.fail)} ` +
    `${"chunks".padStart(w.chunks)} ` +
    `${"dt_s".padEnd(w.dt_s)}`;
  const inner = labels.trimStart().length;

  console.log("\n  progress");
  console.log(`  ${"-".repeat(inner)}`);
  console.log(labels);
  console.log(`  ${"-".repeat(inner)}`);
}

function logProgressRow(phase: string, c: Counters, dtSec: number): void {
  const w = PROGRESS_W;
  const dtStr = `${dtSec.toFixed(1)}s`.padStart(w.dt_s);

  console.log(
    `  ${phase.slice(0, w.phase).padEnd(w.phase)} ` +
      `${String(c.handled).padStart(w.handled)} ` +
      `${String(c.eligibleSeen).padStart(w.eligible)} ` +
      `${String(c.skippedAlreadyMigrated).padStart(w.skipped)} ` +
      `${String(c.classifiedGood).padStart(w.keep)} ` +
      `${String(c.filtered).padStart(w.drop)} ` +
      `${String(c.empty).padStart(w.empty)} ` +
      `${String(c.migratedSuccessful).padStart(w.migOK)} ` +
      `${String(c.failed).padStart(w.fail)} ` +
      `${String(c.chunksWritten).padStart(w.chunks)} ` +
      `${dtStr}`
  );
}

/** Indented two-column line for processing notices (monospace). */
function logProc(kind: string, message: string, stream: "log" | "warn" | "error" = "log"): void {
  const line = `  ${kind.padEnd(10)}  ${message}`;

  if (stream === "warn") {
    console.warn(line);
  } else if (stream === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

async function markLegacyMigrated(
  client: QdrantClient,
  pointId: string | number,
  extra: Record<string, unknown>,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    return;
  }
  await client.setPayload(LEGACY_COLLECTION, {
    wait: true,
    payload: { migrated_to_v2: true, ...extra },
    points: [pointId],
  });
}

type VerifyAccumulator = {
  chunksChecked: number;
  storeFieldFailed: number;
  uuidFailed: number;
};

type BytesAccumulator = {
  vectors: number;
  payload: number;
};

/**
 * Chunk plaintext, embed with Ollama, optionally encrypt payload fields, upsert into {@link V2_COLLECTION}.
 * Shared by legacy scroll migration and `--memory` inject mode.
 */
async function writeMemoryChunksToV2(opts: {
  client: QdrantClient;
  plaintext: string;
  sourceMemoryId: string;
  userId: string | undefined;
  createdAt: string;
  migratedFromCollection: string;
  embeddingDims: number;
  dryRun: boolean;
  verification: boolean;
  onEmbedBatch?: (t: EmbedBatchTiming) => void;
  counters: Counters;
  verify: VerifyAccumulator;
  bytes: BytesAccumulator;
}): Promise<void> {
  const {
    client,
    plaintext,
    sourceMemoryId,
    userId,
    createdAt,
    migratedFromCollection,
    embeddingDims,
    dryRun,
    verification,
    onEmbedBatch,
    counters,
    verify,
    bytes,
  } = opts;

  const chunks = chunkMemoryText(
    plaintext,
    migrateMemoryChunkDefaults.maxChunkChars,
    migrateMemoryChunkDefaults.overlapChars
  );
  const embeddings = await embedTextsBatched(
    OLLAMA_EMBED_MODEL,
    chunks,
    EMBED_BATCH_MAX,
    onEmbedBatch
  );

  if (embeddings.length !== chunks.length) {
    throw new Error(`Embedding count ${embeddings.length} !== chunks ${chunks.length}`);
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunkPlain = chunks[i]!;
    const vector = embeddings[i]!;

    if (vector.length !== embeddingDims) {
      throw new Error(`Embedding dim mismatch: got ${vector.length}, expected ${embeddingDims}`);
    }

    const chunkId = v2ChunkPointId(sourceMemoryId, i);

    const v2Payload: Record<string, unknown> = {
      ...(userId ? { userId } : {}),
      data: storeDataField(chunkPlain),
      hash: md5Hex(chunkPlain),
      createdAt,
      updatedAt: new Date().toISOString(),
      sourceMemoryId,
      chunkIndex: i,
      chunkCount: chunks.length,
      embeddingModel: OLLAMA_EMBED_MODEL,
      migratedFromCollection,
    };

    if (verification) {
      verify.chunksChecked++;
      const stored = String(v2Payload.data);

      if (isMemoryEncryptionEnvConfigured()) {
        if (!isEncrypted(stored) || decryptMemory(stored) !== chunkPlain) {
          verify.storeFieldFailed++;
          logProc(
            "verify",
            `v2 data: expected encrypted round-trip  source=${sourceMemoryId}  chunk=${i}`,
            "warn"
          );
        }
      } else if (stored !== chunkPlain || isEncrypted(stored)) {
        verify.storeFieldFailed++;
        logProc(
          "verify",
          `v2 data: expected plaintext (no enc env)  source=${sourceMemoryId}  chunk=${i}`,
          "warn"
        );
      }
      if (!isUuidShape(chunkId)) {
        verify.uuidFailed++;
        logProc("verify", `chunk id not UUID-shaped  ${chunkId}`, "warn");
      }
    }

    if (!dryRun) {
      await client.upsert(V2_COLLECTION, {
        wait: true,
        points: [
          {
            id: chunkId,
            vector,
            payload: v2Payload,
          },
        ],
      });
    }
    counters.chunksWritten++;
    bytes.vectors += embeddingDims * 4;
    bytes.payload += estimatePayloadBytes(v2Payload);
  }
}

async function runMemoryInject(parsed: ParsedCli): Promise<void> {
  const scriptStart = performance.now();
  const plaintext = parsed.memoryPlaintext!.trim();

  if (!plaintext) {
    throw new Error("--memory text is empty (after trim)");
  }

  const userId = process.env.MIGRATE_MEMORY_USER_ID?.trim();

  if (!userId) {
    throw new Error(
      "MIGRATE_MEMORY_USER_ID is required for --memory (written to each chunk payload as userId for retrieval filters)"
    );
  }

  if (!MEMORY_KEY?.trim()) {
    throw new Error("MEMORY_API_SECRET is required for Qdrant");
  }

  const sourceMemoryId = uuidv5(
    `${userId}|${md5Hex(plaintext)}`,
    MANUAL_INJECT_SOURCE_ID_NAMESPACE
  );
  const createdAt = new Date().toISOString();
  const client = getMemoryQdrantClient();

  const embeddingDims = await probeEmbeddingDims(OLLAMA_EMBED_MODEL);

  logMetricTable(
    "memory inject",
    [
      { k: "target collection", v: V2_COLLECTION },
      { k: "dryRun", v: String(parsed.dryRun) },
      { k: "verification", v: String(parsed.verification) },
      { k: "userId prefix", v: `${userId.slice(0, 8)}…` },
      { k: "sourceMemoryId", v: sourceMemoryId },
      { k: "migratedFromCollection", v: MANUAL_INJECT_FROM_COLLECTION },
    ],
    72
  );

  logMetricTable(
    "embed",
    [
      { k: "OLLAMA_URL", v: OLLAMA_URL },
      { k: "model", v: OLLAMA_EMBED_MODEL },
      { k: "vector dims", v: String(embeddingDims) },
    ],
    72
  );

  if (!parsed.dryRun) {
    await ensureV2Collection(client, embeddingDims);
  }

  const embedPerTextMsSamples: number[] = [];
  let totalEmbedWallMs = 0;
  const recordEmbedBatch = ({ textCount, ms }: EmbedBatchTiming) => {
    totalEmbedWallMs += ms;
    if (textCount <= 0) {
      return;
    }
    const per = ms / textCount;

    for (let i = 0; i < textCount; i++) {
      embedPerTextMsSamples.push(per);
    }
  };

  const counters: Counters = {
    skippedAlreadyMigrated: 0,
    eligibleSeen: 0,
    handled: 0,
    filtered: 0,
    empty: 0,
    failed: 0,
    chunksWritten: 0,
    classifiedGood: 0,
    migratedSuccessful: 0,
  };

  const verify: VerifyAccumulator = { chunksChecked: 0, storeFieldFailed: 0, uuidFailed: 0 };
  const bytesWrite: BytesAccumulator = { vectors: 0, payload: 0 };

  try {
    await writeMemoryChunksToV2({
      client,
      plaintext,
      sourceMemoryId,
      userId,
      createdAt,
      migratedFromCollection: MANUAL_INJECT_FROM_COLLECTION,
      embeddingDims,
      dryRun: parsed.dryRun,
      verification: parsed.verification,
      onEmbedBatch: recordEmbedBatch,
      counters,
      verify,
      bytes: bytesWrite,
    });
    counters.handled = 1;
    counters.migratedSuccessful = 1;
    counters.classifiedGood = 1;
  } catch (err) {
    counters.failed = 1;
    console.error(err);
    throw err;
  }

  const scriptWallMs = performance.now() - scriptStart;
  const nEmbedTexts = embedPerTextMsSamples.length;
  const avgEmbedPerTextMs = nEmbedTexts > 0 ? totalEmbedWallMs / nEmbedTexts : 0;
  const p50EmbedPerTextMs = quantileMs(embedPerTextMsSamples, 0.5);
  const p95EmbedPerTextMs = quantileMs(embedPerTextMsSamples, 0.95);
  const bytesTotalWritten = bytesWrite.vectors + bytesWrite.payload;
  const vecNote = `${counters.chunksWritten}×${embeddingDims}×4`;

  console.log("\n  done (memory inject)");

  logMetricTable(
    "counts",
    [
      { k: "chunks written (or simulated)", v: String(counters.chunksWritten) },
      { k: "inject outcome", v: counters.failed > 0 ? "failed" : "ok" },
    ],
    72
  );

  logMetricTable(
    "timing",
    [
      { k: "script wall", v: `${(scriptWallMs / 1000).toFixed(2)} s` },
      { k: "embed texts", v: String(nEmbedTexts) },
      { k: "embed HTTP wall (sum)", v: `${(totalEmbedWallMs / 1000).toFixed(2)} s` },
      { k: "embed avg / text", v: `${avgEmbedPerTextMs.toFixed(2)} ms` },
      { k: "embed p50 / text", v: `${p50EmbedPerTextMs.toFixed(2)} ms` },
      { k: "embed p95 / text", v: `${p95EmbedPerTextMs.toFixed(2)} ms` },
    ],
    72
  );

  logMetricTable(
    "data written (estimate)",
    [
      { k: "vectors (float32)", v: `${formatBytes(bytesWrite.vectors)}  (${vecNote})` },
      { k: "payloads (JSON utf-8)", v: formatBytes(bytesWrite.payload) },
      { k: "total", v: formatBytes(bytesTotalWritten) },
    ],
    72
  );

  if (parsed.verification) {
    const encOn = isMemoryEncryptionEnvConfigured();
    const storeLabel = encOn
      ? "v2 data (encrypted + decrypt round-trip)"
      : "v2 data (plaintext, no enc env)";
    const storeVal =
      verify.chunksChecked === 0
        ? "n/a (no chunks)"
        : verify.storeFieldFailed === 0
          ? `PASS  (${verify.chunksChecked} chunks)`
          : `FAIL  (${verify.storeFieldFailed}/${verify.chunksChecked})`;
    const uuidVal =
      verify.chunksChecked === 0
        ? "n/a"
        : verify.uuidFailed === 0
          ? `PASS  (${verify.chunksChecked})`
          : `FAIL  (${verify.uuidFailed}/${verify.chunksChecked})`;
    const errVal = counters.failed === 0 ? "PASS" : `FAIL  (${counters.failed})`;

    const storePass = verify.chunksChecked === 0 || verify.storeFieldFailed === 0;
    const uuidPass = verify.chunksChecked === 0 || verify.uuidFailed === 0;
    const overall = counters.failed === 0 && storePass && uuidPass ? "PASS" : "FAIL";

    logMetricTable(
      "verification summary",
      [
        { k: "dry-run (no Qdrant writes)", v: "yes" },
        { k: "MEMORY_ENCRYPTION_* active", v: encOn ? "yes" : "no" },
        { k: storeLabel, v: storeVal },
        { k: "chunk point ids UUID-shaped", v: uuidVal },
        { k: "inject errors", v: errVal },
        { k: "chunks checked", v: String(verify.chunksChecked) },
        { k: "script wall", v: `${(scriptWallMs / 1000).toFixed(2)} s` },
        { k: "overall", v: overall },
      ],
      72
    );

    if (overall === "FAIL") {
      process.exit(1);
    }
  }
}

async function main() {
  const scriptStart = performance.now();
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.memoryPlaintext !== undefined) {
    await runMemoryInject(parsed);

    return;
  }

  const { dryRun, limit, verification } = parsed;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required for memory quality classification");
  }

  const client = getMemoryQdrantClient();
  let legacyTotalPoints = 0;
  let legacyCountLabel = "—";

  try {
    legacyTotalPoints = (await client.count(LEGACY_COLLECTION, { exact: true })).count;
    legacyCountLabel = String(legacyTotalPoints);
  } catch {
    legacyCountLabel = "(count failed)";
    logProc("warn", "legacy collection count failed (continuing)", "warn");
  }

  const runRows: { k: string; v: string }[] = [
    { k: "collections", v: `${LEGACY_COLLECTION} → ${V2_COLLECTION}` },
    { k: "dryRun", v: String(dryRun) },
    { k: "limit", v: String(limit ?? "none") },
    { k: "verification", v: String(verification) },
    { k: "legacy total (Qdrant)", v: legacyCountLabel },
  ];

  logMetricTable("run", runRows, 72);
  if (verification) {
    logProc("note", "verification implies dry-run; limit defaults to 3 without --limit");
  }

  const embeddingDims = await probeEmbeddingDims(OLLAMA_EMBED_MODEL);

  logMetricTable(
    "embed",
    [
      { k: "OLLAMA_URL", v: OLLAMA_URL },
      { k: "model", v: OLLAMA_EMBED_MODEL },
      { k: "vector dims", v: String(embeddingDims) },
    ],
    72
  );

  if (!dryRun) {
    await ensureV2Collection(client, embeddingDims);
  }

  const droppedMemories: string[] = [];
  const classifyTimesMs: number[] = [];
  const embedPerTextMsSamples: number[] = [];
  const bytesWrite: BytesAccumulator = { vectors: 0, payload: 0 };

  let totalEmbedWallMs = 0;

  const recordEmbedBatch = ({ textCount, ms }: EmbedBatchTiming) => {
    totalEmbedWallMs += ms;
    if (textCount <= 0) {
      return;
    }
    const per = ms / textCount;

    for (let i = 0; i < textCount; i++) {
      embedPerTextMsSamples.push(per);
    }
  };

  const counters: Counters = {
    skippedAlreadyMigrated: 0,
    eligibleSeen: 0,
    handled: 0,
    filtered: 0,
    empty: 0,
    failed: 0,
    chunksWritten: 0,
    classifiedGood: 0,
    migratedSuccessful: 0,
  };

  const verify: VerifyAccumulator = { chunksChecked: 0, storeFieldFailed: 0, uuidFailed: 0 };

  let lastLog = Date.now();
  let progressHeaderPrinted = false;
  const maybeLog = (label: string) => {
    const now = Date.now();
    const elapsedSec = (now - lastLog) / 1000;
    const everyTen = counters.handled > 0 && counters.handled % 10 === 0;

    if (everyTen || elapsedSec >= 30) {
      if (!progressHeaderPrinted) {
        logProgressHeader();
        progressHeaderPrinted = true;
      }
      logProgressRow(label, counters, elapsedSec);
      lastLog = now;
    }
  };

  const classifyLimit = pLimit(CLASSIFY_CONCURRENCY);

  let nextOffset: string | number | Record<string, unknown> | null | undefined = undefined;
  let stopScrolling = false;

  while (!stopScrolling) {
    const scroll = await client.scroll(LEGACY_COLLECTION, {
      limit: SCROLL_PAGE_SIZE,
      ...(nextOffset !== undefined && nextOffset !== null ? { offset: nextOffset } : {}),
      with_payload: true,
      with_vector: false,
    });

    const points = scroll.points ?? [];

    // Helper to process a single point — same logic as before, just extracted
    const processPoint = async (point: (typeof points)[number]): Promise<void> => {
      const id = point.id;
      const payload = (point.payload ?? {}) as Record<string, unknown>;

      if (isMigrated(payload)) {
        counters.skippedAlreadyMigrated++;
        return;
      }

      counters.eligibleSeen++;

      const rawData = payload.data;
      const dataStr = typeof rawData === "string" ? rawData : "";

      try {
        const plaintext = decryptDataField(dataStr).trim();

        if (!plaintext) {
          counters.empty++;
          counters.handled++;
          await markLegacyMigrated(client, id, { migrationSkipped: "empty" }, dryRun);
          maybeLog("empty");
          return;
        }

        const quality = await classifyMemory(plaintext, (ms) => classifyTimesMs.push(ms));

        if (quality.decision === "drop") {
          counters.filtered++;
          counters.handled++;
          droppedMemories.push(`id=${String(id)} ${singleLineForLog(plaintext)}`);
          await markLegacyMigrated(
            client,
            id,
            { migrationQuality: "filtered", migrationFilterReason: quality.reason ?? "" },
            dryRun
          );
          maybeLog("filtered");
          return;
        }

        counters.classifiedGood++;

        const createdAt =
          typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString();
        const userId = payloadUserId(payload);

        await writeMemoryChunksToV2({
          client,
          plaintext,
          sourceMemoryId: String(id),
          userId,
          createdAt,
          migratedFromCollection: LEGACY_COLLECTION,
          embeddingDims,
          dryRun,
          verification,
          onEmbedBatch: recordEmbedBatch,
          counters,
          verify,
          bytes: bytesWrite,
        });

        counters.handled++;
        counters.migratedSuccessful++;
        await markLegacyMigrated(client, id, { migrationQuality: "migrated" }, dryRun);
        maybeLog("ok");
      } catch (err) {
        counters.failed++;
        const extra =
          err && typeof err === "object" && "data" in err
            ? ` body=${JSON.stringify((err as { data: unknown }).data)}`
            : "";

        logProc("error", `${String(id).padEnd(36)}${extra.slice(0, 200)}`, "error");
        console.error(err);
      }
    };

    // Honor --limit by slicing the page before fan-out
    const pointsThisPage =
      limit !== undefined
        ? points.slice(0, Math.max(0, limit - counters.handled - counters.skippedAlreadyMigrated))
        : points;

    // Fan out concurrent processing, await all before next page
    await Promise.all(pointsThisPage.map((p) => classifyLimit(() => processPoint(p))));

    if (limit !== undefined && counters.handled >= limit) {
      stopScrolling = true;
    }

    if (stopScrolling) {
      break;
    }

    nextOffset = scroll.next_page_offset;
    if (nextOffset === null || nextOffset === undefined) {
      break;
    }
    if (points.length === 0) {
      break;
    }
  }

  let legacyTotalEnd = legacyTotalPoints;
  let v2CountLabel = "—";
  let legacyRemainingCount = -1;

  try {
    legacyTotalEnd = (await client.count(LEGACY_COLLECTION, { exact: true })).count;
    try {
      const v2Total = await client.count(V2_COLLECTION, { exact: true });

      v2CountLabel = String(v2Total.count);
    } catch {
      v2CountLabel = "(count failed)";
    }

    const legacyRemaining = await client.count(LEGACY_COLLECTION, {
      exact: true,
      filter: {
        must_not: [{ key: "migrated_to_v2", match: { value: true } }],
      },
    });

    legacyRemainingCount = legacyRemaining.count;
  } catch (e) {
    console.warn("\n  [warn] Qdrant count queries incomplete:", e);
  }

  const scriptWallMs = performance.now() - scriptStart;

  const nClassify = classifyTimesMs.length;
  const sumClassify = classifyTimesMs.reduce((a, b) => a + b, 0);
  const nEmbedTexts = embedPerTextMsSamples.length;
  const avgClassifyMs = nClassify > 0 ? sumClassify / nClassify : 0;
  const p95ClassifyMs = quantileMs(classifyTimesMs, 0.95);
  const avgEmbedPerTextMs = nEmbedTexts > 0 ? totalEmbedWallMs / nEmbedTexts : 0;
  const p50EmbedPerTextMs = quantileMs(embedPerTextMsSamples, 0.5);
  const p95EmbedPerTextMs = quantileMs(embedPerTextMsSamples, 0.95);
  const p50ClassifyMs = quantileMs(classifyTimesMs, 0.5);
  const bytesTotalWritten = bytesWrite.vectors + bytesWrite.payload;

  console.log("\n  done");

  console.log("\n  dropped by LLM (bad memories)");
  console.log(`  ${"-".repeat(72)}`);
  if (droppedMemories.length === 0) {
    console.log("  (none)");
  } else {
    for (const line of droppedMemories) {
      console.log(`  ${line}`);
    }
  }

  const countRows: { k: string; v: string }[] = [
    { k: "legacy total points", v: String(legacyTotalEnd) },
    { k: "v2 total points (after run)", v: v2CountLabel },
  ];

  if (legacyRemainingCount >= 0) {
    countRows.push({ k: "legacy unmigrated (no migrated_to_v2)", v: String(legacyRemainingCount) });
  }
  countRows.push(
    { k: "this run: eligible rows", v: String(counters.eligibleSeen) },
    { k: "this run: skipped (already migrated)", v: String(counters.skippedAlreadyMigrated) },
    { k: "this run: LLM keep", v: String(counters.classifiedGood) },
    { k: "this run: LLM drop", v: String(counters.filtered) },
    { k: "this run: empty skipped", v: String(counters.empty) },
    { k: "this run: migrated OK", v: String(counters.migratedSuccessful) },
    { k: "this run: failed (no migrate flag)", v: String(counters.failed) },
    { k: "this run: chunks written", v: String(counters.chunksWritten) },
    { k: "this run: legacy finalized (ok+drop+empty)", v: String(counters.handled) }
  );
  logMetricTable("counts", countRows, 72);

  logMetricTable(
    "timing",
    [
      { k: "script wall", v: `${(scriptWallMs / 1000).toFixed(2)} s` },
      { k: "classify calls", v: String(nClassify) },
      { k: "classify wall", v: `${(sumClassify / 1000).toFixed(2)} s` },
      { k: "classify avg", v: `${avgClassifyMs.toFixed(1)} ms` },
      { k: "classify p50", v: `${p50ClassifyMs.toFixed(1)} ms` },
      { k: "classify p95", v: `${p95ClassifyMs.toFixed(1)} ms` },
      { k: "embed texts", v: String(nEmbedTexts) },
      { k: "embed HTTP wall (sum)", v: `${(totalEmbedWallMs / 1000).toFixed(2)} s` },
      { k: "embed avg / text", v: `${avgEmbedPerTextMs.toFixed(2)} ms` },
      { k: "embed p50 / text", v: `${p50EmbedPerTextMs.toFixed(2)} ms` },
      { k: "embed p95 / text", v: `${p95EmbedPerTextMs.toFixed(2)} ms` },
    ],
    72
  );

  const vecNote = `${counters.chunksWritten}×${embeddingDims}×4`;

  logMetricTable(
    "data written (estimate)",
    [
      { k: "vectors (float32)", v: `${formatBytes(bytesWrite.vectors)}  (${vecNote})` },
      { k: "payloads (JSON utf-8)", v: formatBytes(bytesWrite.payload) },
      { k: "total", v: formatBytes(bytesTotalWritten) },
    ],
    72
  );

  if (verification) {
    const encOn = isMemoryEncryptionEnvConfigured();
    const storeLabel = encOn
      ? "v2 data (encrypted + decrypt round-trip)"
      : "v2 data (plaintext, no enc env)";
    const storeVal =
      verify.chunksChecked === 0
        ? "n/a (no kept chunks)"
        : verify.storeFieldFailed === 0
          ? `PASS  (${verify.chunksChecked} chunks)`
          : `FAIL  (${verify.storeFieldFailed}/${verify.chunksChecked})`;
    const uuidVal =
      verify.chunksChecked === 0
        ? "n/a"
        : verify.uuidFailed === 0
          ? `PASS  (${verify.chunksChecked})`
          : `FAIL  (${verify.uuidFailed}/${verify.chunksChecked})`;
    const errVal = counters.failed === 0 ? "PASS" : `FAIL  (${counters.failed})`;

    const storePass = verify.chunksChecked === 0 || verify.storeFieldFailed === 0;
    const uuidPass = verify.chunksChecked === 0 || verify.uuidFailed === 0;
    const overall = counters.failed === 0 && storePass && uuidPass ? "PASS" : "FAIL";

    logMetricTable(
      "verification summary",
      [
        { k: "dry-run (no Qdrant writes)", v: "yes" },
        { k: "limit", v: String(limit ?? 3) },
        { k: "MEMORY_ENCRYPTION_* active", v: encOn ? "yes" : "no" },
        { k: storeLabel, v: storeVal },
        { k: "chunk point ids UUID-shaped", v: uuidVal },
        { k: "per-memory migration errors", v: errVal },
        { k: "eligible rows (this run)", v: String(counters.eligibleSeen) },
        { k: "LLM keep → simulated v2 chunks", v: String(counters.chunksWritten) },
        { k: "script wall (incl. counts)", v: `${(scriptWallMs / 1000).toFixed(2)} s` },
        { k: "overall", v: overall },
      ],
      72
    );

    if (overall === "FAIL") {
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
