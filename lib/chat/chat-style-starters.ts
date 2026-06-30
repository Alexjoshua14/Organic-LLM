import type { ChatStyle } from "@/lib/chat/chat-style";

/** Chip label + composer body, or a single string used for both. */
export type ChatStyleStarter =
  | string
  | {
      label: string;
      prompt: string;
    };

export function resolveChatStarterLabel(starter: ChatStyleStarter): string {
  return typeof starter === "string" ? starter : starter.label;
}

export function resolveChatStarterPrompt(starter: ChatStyleStarter): string {
  return typeof starter === "string" ? starter : starter.prompt;
}

const STITCH_THIS_TOGETHER: ChatStyleStarter = {
  label: "Stitch This Together",
  prompt: `This thread is about building this idea I have in my head. Please directly stitch my pieces together as I send in messages. Your latest message should continue to be relatively the same as the last one but it should have any updates that should be included based on my latest message. Allow me to revert specific changes, as well as instruct you to make targeted, specific, limited scope changes. Do not scope creep. Make no mistakes.`,
};

/** Curated starter prompts per Arcadia chat style — injected into the composer on click. */
export const CHAT_STYLE_STARTERS: Record<ChatStyle, readonly ChatStyleStarter[]> = {
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
    STITCH_THIS_TOGETHER,
    "Organize these notes—don't add outside facts.",
    "Turn this brain dump into a clean outline.",
  ],
};
