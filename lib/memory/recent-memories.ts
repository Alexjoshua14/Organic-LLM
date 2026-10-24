import type { MemoryItemType } from "@/lib/schemas/memory";

export type RecentMemoryWindow = "hour" | "day";

export const RECENT_MEMORY_WINDOW_MS: Record<RecentMemoryWindow, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

/** Hard cap so a full Mem0 getAll does not flood the model context. */
export const LIST_RECENT_MEMORIES_MAX = 50;

/**
 * Timestamp used for "new" filtering: prefer `createdAt`, then `updatedAt`.
 * Returns null when neither is a parseable date (item is excluded).
 */
export function memoryActivityAt(memory: {
  createdAt?: string | null;
  updatedAt?: string | null;
}): number | null {
  const raw = memory.createdAt ?? memory.updatedAt;

  if (!raw) return null;
  const ms = new Date(raw).getTime();

  return Number.isFinite(ms) ? ms : null;
}

/**
 * Keeps memories whose create/update time falls on or after `sinceMs`, newest first.
 * Caps at {@link LIST_RECENT_MEMORIES_MAX}.
 */
export function filterMemoriesSince(
  memories: MemoryItemType[],
  sinceMs: number,
  max: number = LIST_RECENT_MEMORIES_MAX
): MemoryItemType[] {
  const kept = memories.filter((m) => {
    const at = memoryActivityAt(m);

    return at != null && at >= sinceMs;
  });

  kept.sort((a, b) => {
    const aTime = memoryActivityAt(a) ?? 0;
    const bTime = memoryActivityAt(b) ?? 0;

    return bTime - aTime;
  });

  return kept.slice(0, Math.max(0, max));
}

export function recentMemoryWindowSinceMs(
  window: RecentMemoryWindow,
  nowMs: number = Date.now()
): number {
  return nowMs - RECENT_MEMORY_WINDOW_MS[window];
}
