const STORAGE_PREFIX = "organic-llm-noesis-scroll:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type NoesisScrollSnapshot = {
  scrollTop: number;
  isAtBottom: boolean;
  savedAt: number;
};

export function noesisScrollStorageKey(threadId: string): string {
  return `${STORAGE_PREFIX}${threadId}`;
}

export function parseNoesisScrollSnapshot(raw: string | null): NoesisScrollSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<NoesisScrollSnapshot>;

    if (
      typeof parsed.scrollTop !== "number" ||
      !Number.isFinite(parsed.scrollTop) ||
      typeof parsed.isAtBottom !== "boolean" ||
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt)
    ) {
      return null;
    }

    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      return null;
    }

    return {
      scrollTop: Math.max(0, parsed.scrollTop),
      isAtBottom: parsed.isAtBottom,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadNoesisScrollSnapshot(threadId: string): NoesisScrollSnapshot | null {
  if (!threadId || !canUseLocalStorage()) return null;

  try {
    return parseNoesisScrollSnapshot(localStorage.getItem(noesisScrollStorageKey(threadId)));
  } catch {
    return null;
  }
}

export function saveNoesisScrollSnapshot(
  threadId: string,
  snapshot: Pick<NoesisScrollSnapshot, "scrollTop" | "isAtBottom">
): void {
  if (!threadId || !canUseLocalStorage()) return;

  try {
    const payload: NoesisScrollSnapshot = {
      scrollTop: Math.max(0, snapshot.scrollTop),
      isAtBottom: snapshot.isAtBottom,
      savedAt: Date.now(),
    };

    localStorage.setItem(noesisScrollStorageKey(threadId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function noesisConversationInitial(
  snapshot: NoesisScrollSnapshot | null
): false | "instant" {
  if (snapshot && !snapshot.isAtBottom) return false;

  return "instant";
}
