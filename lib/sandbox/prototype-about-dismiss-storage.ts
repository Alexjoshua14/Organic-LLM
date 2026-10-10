/**
 * Persist dismissals for the floating prototype About chips
 * ("Needs your input" / "What is this?") across navigations.
 */

export const PROTOTYPE_ABOUT_DISMISS_STORAGE_KEY = "organic-llm-prototype-about-dismissed";

export const PROTOTYPE_ABOUT_CHIP_IDS = ["needs-input", "what-is-this"] as const;

export type PrototypeAboutChipId = (typeof PROTOTYPE_ABOUT_CHIP_IDS)[number];

export type PrototypeAboutDismissRecord = Partial<Record<PrototypeAboutChipId, true>>;

export function parsePrototypeAboutDismissRecord(raw: string | null): PrototypeAboutDismissRecord {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const record: PrototypeAboutDismissRecord = {};

    for (const id of PROTOTYPE_ABOUT_CHIP_IDS) {
      if ((parsed as Record<string, unknown>)[id] === true) {
        record[id] = true;
      }
    }

    return record;
  } catch {
    return {};
  }
}

export function readPrototypeAboutDismissRecord(
  storage: Pick<Storage, "getItem"> | null | undefined
): PrototypeAboutDismissRecord {
  if (!storage) return {};

  return parsePrototypeAboutDismissRecord(storage.getItem(PROTOTYPE_ABOUT_DISMISS_STORAGE_KEY));
}

export function isPrototypeAboutChipDismissed(
  record: PrototypeAboutDismissRecord,
  id: PrototypeAboutChipId
): boolean {
  return record[id] === true;
}

export function dismissPrototypeAboutChipInRecord(
  record: PrototypeAboutDismissRecord,
  id: PrototypeAboutChipId
): PrototypeAboutDismissRecord {
  return { ...record, [id]: true };
}

export function writePrototypeAboutDismissRecord(
  storage: Pick<Storage, "setItem"> | null | undefined,
  record: PrototypeAboutDismissRecord
): void {
  if (!storage) return;

  storage.setItem(PROTOTYPE_ABOUT_DISMISS_STORAGE_KEY, JSON.stringify(record));
}

export function dismissPrototypeAboutChip(
  storage: Storage | null | undefined,
  id: PrototypeAboutChipId
): PrototypeAboutDismissRecord {
  const record = readPrototypeAboutDismissRecord(storage);
  const next = dismissPrototypeAboutChipInRecord(record, id);

  writePrototypeAboutDismissRecord(storage, next);

  return next;
}
