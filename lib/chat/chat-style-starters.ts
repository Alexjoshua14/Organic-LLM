import { parseChatStyle, type ChatStyle } from "@/lib/chat/chat-style";

/** Chip label + priming body with a stable server key. */
export type ChatStyleStarter = {
  id: string;
  label: string;
  prompt: string;
};

export function resolveChatStarterLabel(starter: ChatStyleStarter): string {
  return starter.label;
}

export function resolveChatStarterId(starter: ChatStyleStarter): string {
  return starter.id;
}

export function resolveChatStarterPrompt(starter: ChatStyleStarter): string {
  return starter.prompt;
}

const CHAT_STARTER_KEY_SEP = ":";

/** Encode a stable starter key for DB storage, e.g. `scribe:stitch-this-together`. */
export function encodeChatStarterKey(style: ChatStyle, id: string): string {
  return `${style}${CHAT_STARTER_KEY_SEP}${id}`;
}

export function parseChatStarterKey(
  key: string
): { style: ChatStyle; id: string } | null {
  const sep = key.indexOf(CHAT_STARTER_KEY_SEP);
  if (sep < 1) return null;

  const style = parseChatStyle(key.slice(0, sep));
  const id = key.slice(sep + 1).trim();
  if (!style || !id) return null;

  return { style, id };
}

export function resolveChatStarterByKey(key: string): ChatStyleStarter | undefined {
  const parsed = parseChatStarterKey(key);
  if (!parsed) return undefined;

  const starters = CHAT_STYLE_STARTERS[parsed.style];
  return starters.find((s) => s.id === parsed.id);
}

/** Resolve priming text from a persisted starter key. */
export function resolveChatStarterPromptByKey(key: string): string | undefined {
  const starter = resolveChatStarterByKey(key);
  return starter ? resolveChatStarterPrompt(starter) : undefined;
}

const STITCH_THIS_TOGETHER: ChatStyleStarter = {
  id: "stitch-this-together",
  label: "Stitch This Together",
  prompt: `This thread is about building this idea I have in my head. Please directly stitch my pieces together as I send in messages. Your latest message should continue to be relatively the same as the last one but it should have any updates that should be included based on my latest message. Allow me to revert specific changes, as well as instruct you to make targeted, specific, limited scope changes. Do not scope creep. Make no mistakes.`,
};

/** Curated starter prompts per Arcadia chat style — primed via system prompt when toggled on. */
export const CHAT_STYLE_STARTERS: Record<ChatStyle, readonly ChatStyleStarter[]> = {
  default: [
    {
      id: "think-step-by-step",
      label: "Help me think through this step by step.",
      prompt: "Help me think through this step by step.",
    },
    {
      id: "mind-map-momentum",
      label: "Sketch a mind map of why this idea lost momentum.",
      prompt: "Sketch a mind map of why this idea lost momentum.",
    },
    {
      id: "clarify-before-commit",
      label: "What should I clarify before committing to this direction?",
      prompt: "What should I clarify before committing to this direction?",
    },
  ],
  ergon: [
    {
      id: "setup-kanban",
      label: "Set up a kanban board for this project.",
      prompt: "Set up a kanban board for this project.",
    },
    {
      id: "board-active",
      label: "What's active on my board right now?",
      prompt: "What's active on my board right now?",
    },
    {
      id: "tackle-next",
      label: "What should I tackle next?",
      prompt: "What should I tackle next?",
    },
  ],
  remy: [
    {
      id: "housewarming-menu",
      label: "I'm hosting a housewarming Saturday at 7:30—help me plan the menu.",
      prompt: "I'm hosting a housewarming Saturday at 7:30—help me plan the menu.",
    },
    {
      id: "add-recipe-link",
      label: "Add this recipe to my plan: <paste a link>",
      prompt: "Add this recipe to my plan: <paste a link>",
    },
    {
      id: "shopping-list",
      label: "What do I still need to buy?",
      prompt: "What do I still need to buy?",
    },
  ],
  scribe: [
    STITCH_THIS_TOGETHER,
    {
      id: "organize-notes",
      label: "Organize these notes—don't add outside facts.",
      prompt: "Organize these notes—don't add outside facts.",
    },
    {
      id: "brain-dump-outline",
      label: "Turn this brain dump into a clean outline.",
      prompt: "Turn this brain dump into a clean outline.",
    },
  ],
};
