/**
 * Chat "styles" are user-selectable structured chat flows offered when starting a
 * new Arcadia chat. A style can switch on extra tools/system prompt behavior server-side.
 *
 * v1 ships `default` and `ergon` (LLM-run kanban board). The selection is held
 * client-side per thread and sent on each request; v2 can persist it on the thread.
 */
export const CHAT_STYLES = [
  {
    id: "default",
    label: "Standard",
    description: "Open-ended conversation. Structured blocks appear when they help.",
  },
  {
    id: "ergon",
    label: "Ergon board",
    description:
      "A living kanban board the assistant keeps for you. Ask for views like \u201cwhat\u2019s active\u201d or \u201cwhat\u2019s next\u201d.",
  },
  {
    id: "scribe",
    label: "Scribe",
    description:
      "The assistant only organizes and presents what you say \u2014 it never adds information or outside knowledge.",
  },
] as const;

export type ChatStyle = (typeof CHAT_STYLES)[number]["id"];

export const DEFAULT_CHAT_STYLE: ChatStyle = "default";

const CHAT_STYLE_IDS = new Set<string>(CHAT_STYLES.map((s) => s.id));

/** Lowercase/trim; returns a canonical style only when it matches {@link CHAT_STYLES}. */
export function parseChatStyle(raw: string | undefined | null): ChatStyle | undefined {
  if (raw === undefined || raw === null) return undefined;
  const normalized = raw.trim().toLowerCase();

  if (normalized === "") return undefined;

  return CHAT_STYLE_IDS.has(normalized) ? (normalized as ChatStyle) : undefined;
}
