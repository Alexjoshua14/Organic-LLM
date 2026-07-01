import { z } from "zod";

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
    description: "Open chat. Structured blocks when they help.",
    guide:
      "Everyday Arcadia chat — concise replies, tools when useful, structured blocks for lists and steps.",
  },
  {
    id: "ergon",
    label: "Ergon board",
    description: "Kanban the assistant keeps. Ask what's active or next.",
    guide:
      "The assistant maintains a kanban board in-thread. Ask what's in progress, what's blocked, or what's next.",
  },
  {
    id: "remy",
    label: "Remy",
    description: "Plan a meal for an event—recipes, ingredients, and a shopping list.",
  },
  {
    id: "remy",
    label: "Remy",
    description: "Plan a meal for an event—recipes, ingredients, and a shopping list.",
  },
  {
    id: "scribe",
    label: "Scribe",
    description: "Organizes your words only — no outside facts.",
    guide:
      "Rewrites and structures what you provide — no web search or invented facts. Best for drafts you already have.",
  },
] as const;

export type ChatStyle = (typeof CHAT_STYLES)[number]["id"];

export const DEFAULT_CHAT_STYLE: ChatStyle = "default";

/** Tuple of style ids, kept in sync with {@link CHAT_STYLES} for building zod schemas. */
export const CHAT_STYLE_ID_VALUES = CHAT_STYLES.map((s) => s.id) as [ChatStyle, ...ChatStyle[]];

/** Canonical zod enum of chat-style ids — the single source of truth for request validation. */
export const ChatStyleSchema = z.enum(CHAT_STYLE_ID_VALUES);

const CHAT_STYLE_IDS = new Set<string>(CHAT_STYLE_ID_VALUES);

/** Lowercase/trim; returns a canonical style only when it matches {@link CHAT_STYLES}. */
export function parseChatStyle(raw: string | undefined | null): ChatStyle | undefined {
  if (raw === undefined || raw === null) return undefined;
  const normalized = raw.trim().toLowerCase();

  if (normalized === "") return undefined;

  return CHAT_STYLE_IDS.has(normalized) ? (normalized as ChatStyle) : undefined;
}

export function resolveChatStyleMeta(style: ChatStyle): (typeof CHAT_STYLES)[number] {
  return CHAT_STYLES.find((entry) => entry.id === style) ?? CHAT_STYLES[0];
}
