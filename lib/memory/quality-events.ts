import "server-only";

import {
  insertMemoryQualityEventRow,
} from "@/data/supabase/memory-quality";
import { createLogger } from "@/lib/logger";
import type {
  MemoryQualityEventType,
  MemoryQualitySource,
} from "@/lib/schemas/memory-quality";

const logger = createLogger("lib/memory/quality-events");

const FORBIDDEN_METADATA_KEYS = new Set([
  "memory",
  "text",
  "content",
  "note",
  "body",
  "message",
  "messages",
]);

export type RecordMemoryEventArgs = {
  userId: string;
  event: MemoryQualityEventType;
  source: MemoryQualitySource;
  memoryId?: string;
  charCount?: number;
  wordCount?: number;
  metadata?: Record<string, unknown>;
};

function countWords(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) return 0;

  return trimmed.split(/\s+/).length;
}

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata) return {};

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lower = key.toLowerCase();

    if (FORBIDDEN_METADATA_KEYS.has(lower)) {
      logger.error("sanitizeMetadata", `Rejected forbidden metadata key: ${key}`);

      continue;
    }
    if (typeof value === "string" && value.length > 256) {
      out[key] = `[truncated:${value.length}]`;

      continue;
    }
    out[key] = value;
  }

  return out;
}

function logMemoryEventTelemetry(args: RecordMemoryEventArgs): void {
  // eslint-disable-next-line no-console -- ZDR-safe structured telemetry
  console.info(
    JSON.stringify({
      event: "memory-quality",
      type: args.event,
      source: args.source,
      memoryId: args.memoryId ?? null,
      charCount: args.charCount ?? null,
      wordCount: args.wordCount ?? null,
      metadata: sanitizeMetadata(args.metadata),
    })
  );
}

export function memoryTextMetrics(text: string): { charCount: number; wordCount: number } {
  return { charCount: text.length, wordCount: countWords(text) };
}

/**
 * Records a ZDR-safe memory quality event (structured log + optional Supabase insert).
 * Never accepts memory text — only counts and opaque ids.
 */
export async function recordMemoryEvent(args: RecordMemoryEventArgs): Promise<void> {
  const wordCount =
    args.wordCount ??
    (typeof args.charCount === "number" ? undefined : undefined);

  const payload: RecordMemoryEventArgs = {
    ...args,
    wordCount: args.wordCount ?? wordCount,
    metadata: sanitizeMetadata(args.metadata),
  };

  logMemoryEventTelemetry(payload);

  await insertMemoryQualityEventRow({
    userId: payload.userId,
    event: payload.event,
    source: payload.source,
    memoryId: payload.memoryId,
    charCount: payload.charCount,
    wordCount: payload.wordCount,
    metadata: payload.metadata,
  }).catch((err) => {
    logger.error(
      "recordMemoryEvent",
      err instanceof Error ? err.message : "insert failed"
    );
  });
}

/** Infer quality source from Mem0 metadata.source string. */
export function inferMemoryQualitySource(metadata?: Record<string, unknown>): MemoryQualitySource {
  const raw = metadata?.source;

  if (raw === "delphi") return "delphi";
  if (raw === "migration") return "migration";

  return "auto_ingest";
}

export async function recordIngestEventsForResults(args: {
  userId: string;
  source: MemoryQualitySource;
  results: Array<{ id?: string; memory?: string }>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  for (const item of args.results) {
    const text = item.memory ?? "";
    const metrics = memoryTextMetrics(text);

    await recordMemoryEvent({
      userId: args.userId,
      event: "ingest",
      source: args.source,
      memoryId: item.id,
      charCount: metrics.charCount,
      wordCount: metrics.wordCount,
      metadata: args.metadata,
    });
  }
}
