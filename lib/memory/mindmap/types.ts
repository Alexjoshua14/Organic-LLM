import type { MemoryItemType } from "@/lib/schemas/memory";

/** One memory row, stripped to what the mind map needs. */
export type MemoryTrace = {
  id: string;
  text: string;
  /** Optional Mem0 metadata.topic (Delphi commits). Wins over inferred labels. */
  topic?: string;
};

/** A categorical island on the map — never the memory text itself. */
export type MemorySector = {
  id: string;
  label: string;
  memoryIds: string[];
};

export const MEMORY_TOUCH_KINDS = ["accessed", "created", "updated", "deleted"] as const;

export type MemoryTouchKind = (typeof MEMORY_TOUCH_KINDS)[number];

export type MemorySectorTouch = {
  sectorId: string;
  kind: MemoryTouchKind;
};

export type ClusterMemoriesOptions = {
  /** Soft cap; overflow merges into an "Other" sector. */
  maxSectors?: number;
  /** Tokens already used as ancestor labels — skipped when clustering a deeper layer. */
  ignoreTokens?: readonly string[];
  /**
   * When true, `topic` metadata is clustered as wording instead of a hard bucket.
   * Used below the root so a topic sector can split into sub-islands.
   */
  treatTopicsAsText?: boolean;
  /** Prefix for generated sector ids (keeps nested layers unique). */
  idPrefix?: string;
};

export const DEFAULT_MAX_MEMORY_MINDMAP_SECTORS = 8;
export const MEMORY_MINDMAP_OTHER_LABEL = "Other";
export const MEMORY_MINDMAP_ROOT_LABEL = "Memory";

export function memoryItemToTrace(item: MemoryItemType): MemoryTrace {
  const raw = item.metadata?.topic;
  const topic = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

  return {
    id: item.id,
    text: item.memory,
    ...(topic ? { topic } : {}),
  };
}
