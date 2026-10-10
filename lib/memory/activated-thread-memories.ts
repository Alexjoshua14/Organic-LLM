import type { UIMessage } from "ai";

/** Hidden UI part. The transcript renders text parts only, so this stays out of the chat UI. */
export const ACTIVATED_MEMORIES_PART_TYPE = "data-activated-memories";

/** Safety cap. Retrieval already limits injection; this bounds a malformed payload. */
export const MAX_ACTIVATED_MEMORIES_PER_MESSAGE = 40;

/** Per-memory cap on stored text. Longer memories are clipped here and condensed by an LLM later. */
export const MAX_ACTIVATED_MEMORY_CHARS = 500;

/** A sentence or word break earlier than this share of the cap loses too much; hard-cut instead. */
const MIN_SENTENCE_BREAK_RATIO = 0.6;
const MIN_WORD_BREAK_RATIO = 0.8;

export type ActivatedMemory = {
  id: string;
  text: string;
};

type ActivatedMemorySource = {
  id?: string | null;
  memory?: string | null;
};

function normalizeMemoryText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Fit text within `maxChars`, ending on a sentence or word boundary when one is
 * close to the cap. The ellipsis marks the cut and counts toward the cap.
 */
export function clipMemoryText(text: string, maxChars = MAX_ACTIVATED_MEMORY_CHARS): string {
  if (text.length <= maxChars) return text;

  const window = text.slice(0, maxChars - 1);
  const sentenceEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? ")
  );

  if (sentenceEnd >= maxChars * MIN_SENTENCE_BREAK_RATIO) {
    return `${window.slice(0, sentenceEnd + 1)}…`;
  }

  const wordEnd = window.lastIndexOf(" ");

  if (wordEnd >= maxChars * MIN_WORD_BREAK_RATIO) {
    return `${window.slice(0, wordEnd).replace(/[\s,;:–—-]+$/, "")}…`;
  }

  return `${window}…`;
}

/**
 * Dedupe retrieved Mem0 rows into the payload stored on a user message.
 * Missing ids fall back to normalized text so the same fact still collapses.
 *
 * `clip: false` keeps full text so `condenseActivatedMemories` can work from the
 * original; anything written to a message is clipped again by `withActivatedMemories`.
 */
export function toActivatedMemories(
  items: ActivatedMemorySource[],
  options: { clip?: boolean } = {}
): ActivatedMemory[] {
  const clip = options.clip ?? true;
  const out: ActivatedMemory[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const text = typeof item.memory === "string" ? normalizeMemoryText(item.memory) : "";

    if (!text) continue;

    const id = (typeof item.id === "string" && item.id.trim()) || `text:${text.toLowerCase()}`;

    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, text: clip ? clipMemoryText(text) : text });

    if (out.length >= MAX_ACTIVATED_MEMORIES_PER_MESSAGE) break;
  }

  return out;
}

export function readActivatedMemories(message: UIMessage): ActivatedMemory[] {
  for (const part of message.parts ?? []) {
    if (part.type !== ACTIVATED_MEMORIES_PART_TYPE || !("data" in part)) continue;

    const data = part.data;

    if (!data || typeof data !== "object" || !("memories" in data)) return [];

    const memories = data.memories;

    if (!Array.isArray(memories)) return [];

    return toActivatedMemories(
      memories.map((entry) => {
        if (!entry || typeof entry !== "object") return { memory: "" };

        const record = entry as { id?: unknown; text?: unknown; memory?: unknown };
        const text =
          typeof record.text === "string"
            ? record.text
            : typeof record.memory === "string"
              ? record.memory
              : "";

        return {
          id: typeof record.id === "string" ? record.id : undefined,
          memory: text,
        };
      })
    );
  }

  return [];
}

/** Model-facing lines for memories activated when this user message was sent. */
export function formatActivatedMemoriesBlock(memories: ActivatedMemory[]): string {
  if (memories.length === 0) return "";

  return `Retrieved memories for this message:\n${memories.map((memory) => `- ${memory.text}`).join("\n")}`;
}

/** Attach this turn's retrieval to a user message. Does not add visible text. */
export function withActivatedMemories(message: UIMessage, memories: ActivatedMemory[]): UIMessage {
  const cleaned = toActivatedMemories(
    memories.map((memory) => ({ id: memory.id, memory: memory.text }))
  );

  if (cleaned.length === 0) return message;

  const parts = (message.parts ?? []).filter((part) => part.type !== ACTIVATED_MEMORIES_PART_TYPE);

  return {
    ...message,
    parts: [
      ...parts,
      {
        type: ACTIVATED_MEMORIES_PART_TYPE,
        data: { memories: cleaned },
      } as UIMessage["parts"][number],
    ],
  };
}

/** Stamp the latest user message in a turn window. Earlier messages are left as stored. */
export function attachActivatedMemoriesToLatestUserMessage(
  messages: UIMessage[],
  memories: ActivatedMemory[]
): UIMessage[] {
  if (memories.length === 0) return messages;

  let index = -1;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      index = i;
      break;
    }
  }

  if (index < 0) return messages;

  const next = messages.slice();

  next[index] = withActivatedMemories(messages[index]!, memories);

  return next;
}

/**
 * Copy the window for the model. Each memory is appended once, on the latest
 * in-window user message that carries it, so a fact stays beside recent context
 * without being repeated on every earlier turn.
 */
export function expandActivatedMemoriesForModel(messages: UIMessage[]): UIMessage[] {
  const seen = new Set<string>();
  const extra = new Map<number, string>();

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (!message || message.role !== "user") continue;

    const fresh: ActivatedMemory[] = [];

    for (const memory of readActivatedMemories(message)) {
      if (seen.has(memory.id)) continue;
      seen.add(memory.id);
      fresh.push(memory);
    }

    const block = formatActivatedMemoriesBlock(fresh);

    if (block) extra.set(i, block);
  }

  if (extra.size === 0) return messages;

  return messages.map((message, index) => {
    const block = extra.get(index);

    if (!block) return message;

    return {
      ...message,
      parts: [...(message.parts ?? []), { type: "text", text: `\n\n${block}` }],
    };
  });
}
