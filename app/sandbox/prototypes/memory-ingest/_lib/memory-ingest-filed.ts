import { MEMORY_INGEST_RESUME_WINDOW_MS } from "@/lib/chat/memory-ingest";

/** A memory Delphi just committed, surfaced for the transient "Filed … / Undo" receipt. */
export type FiledMemory = {
  /** Mem0 id for Undo; null when the store did not return one (Undo is then unavailable). */
  id: string | null;
  text: string;
  topic?: string;
  /** Client receive time — also used to key/reset the chip per filing. */
  ts: number;
};

/**
 * Parse a transient `data-memoryCommitted` stream part (emitted by Delphi's commit_memory)
 * into a {@link FiledMemory}. Resilient to malformed payloads — returns null unless there is
 * real saved text.
 */
export function parseMemoryCommitted(data: unknown): FiledMemory | null {
  if (!data || typeof data !== "object") return null;
  const part = data as { type?: string; data?: unknown };

  if (part.type !== "data-memoryCommitted" || !part.data || typeof part.data !== "object") {
    return null;
  }
  const payload = part.data as { id?: unknown; text?: unknown; topic?: unknown };
  const text = typeof payload.text === "string" ? payload.text.trim() : "";

  if (!text) return null;

  return {
    id: typeof payload.id === "string" && payload.id.length > 0 ? payload.id : null,
    text,
    topic:
      typeof payload.topic === "string" && payload.topic.trim() ? payload.topic.trim() : undefined,
    ts: Date.now(),
  };
}

/** A failed commit_memory attempt surfaced for the chamber UI. */
export type CommitFailedMemory = {
  text: string;
  topic?: string;
  error: string;
  ts: number;
};

/**
 * Parse a transient `data-memoryCommitFailed` stream part into {@link CommitFailedMemory}.
 */
export function parseMemoryCommitFailed(data: unknown): CommitFailedMemory | null {
  if (!data || typeof data !== "object") return null;
  const part = data as { type?: string; data?: unknown };

  if (part.type !== "data-memoryCommitFailed" || !part.data || typeof part.data !== "object") {
    return null;
  }
  const payload = part.data as { text?: unknown; topic?: unknown; error?: unknown };
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const error = typeof payload.error === "string" ? payload.error.trim() : "";

  if (!text || !error) return null;

  return {
    text,
    error,
    topic:
      typeof payload.topic === "string" && payload.topic.trim() ? payload.topic.trim() : undefined,
    ts: Date.now(),
  };
}

/** sessionStorage key for filings in a memory-ingest thread. */
export function sessionFiledStorageKey(chatId: string): string {
  return `memory-ingest-filed:${chatId}`;
}

/** Locale-formatted filing time for expanded detail rows. */
export function formatFiledAt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function filedDedupeKey(m: FiledMemory): string {
  return m.id ?? String(m.ts);
}

/** Keep filings within the resume window. */
export function filterSessionFiledByWindow(
  items: FiledMemory[],
  now = Date.now(),
  windowMs = MEMORY_INGEST_RESUME_WINDOW_MS
): FiledMemory[] {
  const cutoff = now - windowMs;

  return items.filter((m) => m.ts >= cutoff);
}

/** Prepend a filing, replacing any prior entry with the same id or ts. */
export function appendSessionFiled(prev: FiledMemory[], next: FiledMemory): FiledMemory[] {
  const key = filedDedupeKey(next);

  return [next, ...prev.filter((m) => filedDedupeKey(m) !== key)];
}

/** Remove a filing by Mem0 id. */
export function removeSessionFiled(prev: FiledMemory[], id: string): FiledMemory[] {
  return prev.filter((m) => m.id !== id);
}

function isFiledMemory(value: unknown): value is FiledMemory {
  if (!value || typeof value !== "object") return false;
  const m = value as FiledMemory;

  return (
    typeof m.text === "string" &&
    typeof m.ts === "number" &&
    (m.id === null || typeof m.id === "string")
  );
}

/** Hydrate session filings from sessionStorage (empty on SSR or parse failure). */
export function loadSessionFiled(chatId: string): FiledMemory[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(sessionFiledStorageKey(chatId));

    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [];

    return filterSessionFiledByWindow(parsed.filter(isFiledMemory));
  } catch {
    return [];
  }
}

/** Persist session filings, pruning entries outside the resume window. */
export function saveSessionFiled(chatId: string, items: FiledMemory[]): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      sessionFiledStorageKey(chatId),
      JSON.stringify(filterSessionFiledByWindow(items))
    );
  } catch {
    // ignore quota / private-mode errors
  }
}
