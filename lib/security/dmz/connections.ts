import type { OpenInChatProvider } from "@/lib/export/prompts";

import type { DmzConnectionProvider } from "./types";

export type DmzConnectionMeta = {
  id: DmzConnectionProvider;
  label: string;
  description: string;
  /** Whether Organic LLM can open a deep link with a prepared prompt. */
  supportsOpenIn: boolean;
  openInProvider?: OpenInChatProvider;
  /** Whether the user pastes the response back through DMZ intake. */
  supportsPasteback: boolean;
};

export const DMZ_CONNECTIONS: DmzConnectionMeta[] = [
  {
    id: "notion",
    label: "Notion AI",
    description: "Ask Notion AI about your notes, then paste the answer back through DMZ quarantine.",
    supportsOpenIn: false,
    supportsPasteback: true,
  },
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Query your vault with Obsidian's LLM plugins or Copilot, then paste the response back.",
    supportsOpenIn: false,
    supportsPasteback: true,
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    description: "Open a prepared question in ChatGPT; paste the answer back for quarantine review.",
    supportsOpenIn: true,
    openInProvider: "chatgpt",
    supportsPasteback: true,
  },
  {
    id: "claude",
    label: "Claude",
    description: "Open a prepared question in Claude; paste the answer back for quarantine review.",
    supportsOpenIn: true,
    openInProvider: "claude",
    supportsPasteback: true,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    description: "Research via Perplexity, then paste findings back for security review.",
    supportsOpenIn: false,
    supportsPasteback: true,
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "Copy a Cursor instruction package to your clipboard for local analysis.",
    supportsOpenIn: false,
    supportsPasteback: true,
  },
];

export function getDmzConnection(id: DmzConnectionProvider): DmzConnectionMeta | undefined {
  return DMZ_CONNECTIONS.find((c) => c.id === id);
}
