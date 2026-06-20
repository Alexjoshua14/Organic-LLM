const DEBOUNCE_MS = 5 * 60 * 1000;

export function shouldSkipSyncDebounced(
  snapshotUpdatedAt: string | null | undefined,
  options: { priority: "high" | "normal" | "low"; force?: boolean }
): boolean {
  if (options.force || options.priority === "high") return false;
  if (!snapshotUpdatedAt) return false;

  const updated = Date.parse(snapshotUpdatedAt);

  if (Number.isNaN(updated)) return false;

  return Date.now() - updated < DEBOUNCE_MS;
}
