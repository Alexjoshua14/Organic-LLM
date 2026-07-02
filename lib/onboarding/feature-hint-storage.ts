import type { FeatureHintId } from "./feature-hints";

export const FEATURE_HINT_DISMISS_STORAGE_KEY = "organic-llm-feature-hints-dismissed";

export type FeatureHintDismissRecord = Record<string, number>;

export function parseFeatureHintDismissRecord(raw: string | null): FeatureHintDismissRecord {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const record: FeatureHintDismissRecord = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        record[key] = value;
      }
    }

    return record;
  } catch {
    return {};
  }
}

export function readFeatureHintDismissRecord(
  storage: Pick<Storage, "getItem"> | null | undefined
): FeatureHintDismissRecord {
  if (!storage) return {};

  return parseFeatureHintDismissRecord(storage.getItem(FEATURE_HINT_DISMISS_STORAGE_KEY));
}

export function isFeatureHintDismissed(
  record: FeatureHintDismissRecord,
  id: FeatureHintId,
  version: number
): boolean {
  const dismissedVersion = record[id];

  return typeof dismissedVersion === "number" && dismissedVersion >= version;
}

/** Respects quick-settings replay mode (temporary override of persisted dismissals). */
export function isFeatureHintHidden(
  record: FeatureHintDismissRecord,
  id: FeatureHintId,
  version: number,
  replayFeatureHints: boolean,
  sessionDismissedIds?: ReadonlySet<FeatureHintId>,
  respectDismissInReplay = false
): boolean {
  if (sessionDismissedIds?.has(id)) return true;

  const persistedDismissed = isFeatureHintDismissed(record, id, version);

  if (!persistedDismissed) return false;

  return !replayFeatureHints || respectDismissInReplay;
}

export function dismissFeatureHintInRecord(
  record: FeatureHintDismissRecord,
  id: FeatureHintId,
  version: number
): FeatureHintDismissRecord {
  return { ...record, [id]: version };
}

export function writeFeatureHintDismissRecord(
  storage: Pick<Storage, "setItem"> | null | undefined,
  record: FeatureHintDismissRecord
): void {
  if (!storage) return;

  storage.setItem(FEATURE_HINT_DISMISS_STORAGE_KEY, JSON.stringify(record));
}

export function dismissFeatureHint(
  storage: Storage | null | undefined,
  id: FeatureHintId,
  version: number
): FeatureHintDismissRecord {
  const record = readFeatureHintDismissRecord(storage);
  const next = dismissFeatureHintInRecord(record, id, version);

  writeFeatureHintDismissRecord(storage, next);

  return next;
}

/** Clears all dismiss records — useful when testing coachmarks locally. */
export function resetFeatureHintDismissals(storage: Storage | null | undefined): void {
  if (!storage) return;

  storage.removeItem(FEATURE_HINT_DISMISS_STORAGE_KEY);
}
