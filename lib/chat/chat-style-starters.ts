import type { ChatStyle } from "@/lib/chat/chat-style";

/** Curated starter prompts per Arcadia chat style — injected into the composer on click. */
export const CHAT_STYLE_STARTERS: Record<ChatStyle, readonly string[]> = {
  default: [
    "Help me think through this step by step.",
    "Sketch a mind map of why this idea lost momentum.",
    "What should I clarify before committing to this direction?",
  ],
  ergon: [
    "Set up a kanban board for this project.",
    "What's active on my board right now?",
    "What should I tackle next?",
  ],
  scribe: [
    "Organize these notes—don't add outside facts.",
    "Turn this brain dump into a clean outline.",
    "Summarize only what I've written.",
  ],
};
