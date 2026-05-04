/**
 * Pure helpers for scripts/migrate-memories-v2.ts (chunking, ids, env checks).
 * Kept separate so Bun unit tests do not load Qdrant or network code.
 */

import { v5 as uuidv5 } from "uuid";

const DEFAULT_MAX_CHUNK_CHARS = 1200;

/**
 * RFC 4122 name-based UUID namespace for chunk point ids. Do not change without breaking
 * upsert idempotency for already-migrated data.
 */
const MEMORY_V2_CHUNK_NAMESPACE = "c242092d-eb5f-5f30-a7c8-d9e4f0ebd001";
const DEFAULT_OVERLAP_CHARS = 80;

/** Same contract as {@link isMemoryEncryptionConfigured} in install-mem0-vector-encryption (no server-only). */
export function isMemoryEncryptionEnvConfigured(): boolean {
  const current = process.env.MEMORY_ENCRYPTION_CURRENT_KEY?.trim();

  if (!current || !/^k\d+$/.test(current)) {
    return false;
  }

  const suffix = current.slice(1).toUpperCase();
  const raw = process.env[`MEMORY_ENCRYPTION_KEY_K${suffix}`]?.trim();

  return Boolean(raw && raw.length > 0);
}

/**
 * Deterministic Qdrant point id for a migrated chunk (UUID v5; stable across retries).
 * Hosted Qdrant often accepts only UUID-shaped string ids, not arbitrary strings.
 */
export function v2ChunkPointId(sourceMemoryId: string, chunkIndex: number): string {
  return uuidv5(`mem0-v2-chunk|${sourceMemoryId}|${chunkIndex}`, MEMORY_V2_CHUNK_NAMESPACE);
}

/** Prefer breaking after newline or sentence end within `slice` (relative indices). */
function findBreakInSlice(slice: string): number {
  const n = slice.length;
  if (n <= 1) return n;

  const lastNl = slice.lastIndexOf("\n");
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf(".\n"),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );
  const cut = Math.max(lastNl >= 0 ? lastNl + 1 : -1, lastSentence >= 0 ? lastSentence + 1 : -1);

  if (cut > n * 0.25 && cut < n) {
    return cut;
  }

  return n;
}

/**
 * Split long memory text into overlapping chunks for embedding (character-based).
 */
export function chunkMemoryText(
  text: string,
  maxChunkChars: number = DEFAULT_MAX_CHUNK_CHARS,
  overlapChars: number = DEFAULT_OVERLAP_CHARS
): string[] {
  const t = text.trim();
  if (t.length === 0) {
    return [];
  }
  if (t.length <= maxChunkChars) {
    return [t];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < t.length) {
    const hardEnd = Math.min(start + maxChunkChars, t.length);
    let end = hardEnd;

    if (end < t.length) {
      const relativeBreak = findBreakInSlice(t.slice(start, end));
      end = start + relativeBreak;
      if (end <= start) {
        end = hardEnd;
      }
    }

    const piece = t.slice(start, end).trim();
    if (piece.length > 0) {
      chunks.push(piece);
    }

    if (end >= t.length) {
      break;
    }

    start = Math.max(start + 1, end - overlapChars);
  }

  return chunks.length > 0 ? chunks : [t];
}

export const migrateMemoryChunkDefaults = {
  maxChunkChars: DEFAULT_MAX_CHUNK_CHARS,
  overlapChars: DEFAULT_OVERLAP_CHARS,
} as const;
