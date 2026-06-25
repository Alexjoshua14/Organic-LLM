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
