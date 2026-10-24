import type { UIMessage } from "ai";

import { estimateTokenCountSync } from "@/lib/chat/context-budget";

/**
 * `/btw` context: a compact, text-only view of the thread a side question was asked in.
 * The thread's rolling summary plus its most recent turns, under a hard token cap, instead
 * of the full 50k Arcadia window, memories, and tools a main turn would assemble.
 */
export const BTW_SUMMARY_TOKEN_CAP = 1_200;
export const BTW_RECENT_TOKEN_BUDGET = 3_000;
/** One long reply should not crowd out the rest of the recent tail. */
export const BTW_MESSAGE_TOKEN_CAP = 800;
/** The latest exchange always makes it in, even when it alone fills the budget. */
export const BTW_MIN_RECENT_MESSAGES = 2;

export type BtwContextLoaders = {
  loadSummary: () => Promise<string | null>;
  loadMessages: () => Promise<UIMessage[] | null>;
};

export type BtwContextSnapshot = {
  text: string;
  tokens: number;
  includedMessages: number;
  totalMessages: number;
};

/** Visible prose only: tool calls, reasoning, and data parts stay out of a side question. */
export function messagePlainText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
}

function capTokens(text: string, cap: number): string {
  if (estimateTokenCountSync(text) <= cap) return text;

  // ~4 characters per token; trim by characters, then confirm.
  let end = Math.min(text.length, cap * 4);

  while (end > 0 && estimateTokenCountSync(text.slice(0, end)) > cap) {
    end = Math.floor(end * 0.85);
  }

  return `${text.slice(0, end).trimEnd()}…`;
}

export function buildBtwSnapshotText(
  summary: string | null,
  messages: readonly UIMessage[]
): BtwContextSnapshot {
  const turns: string[] = [];
  let recentTokens = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;

    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = messagePlainText(message);

    if (!text) continue;
    const line = `${message.role === "user" ? "User" : "Assistant"}: ${capTokens(text, BTW_MESSAGE_TOKEN_CAP)}`;
    const tokens = estimateTokenCountSync(line);

    if (
      turns.length >= BTW_MIN_RECENT_MESSAGES &&
      recentTokens + tokens > BTW_RECENT_TOKEN_BUDGET
    ) {
      break;
    }
    turns.unshift(line);
    recentTokens += tokens;
  }

  const sections: string[] = [];
  const trimmedSummary = summary?.trim();

  if (trimmedSummary) {
    sections.push(`Thread summary so far:\n${capTokens(trimmedSummary, BTW_SUMMARY_TOKEN_CAP)}`);
  }
  if (turns.length > 0) {
    sections.push(`Most recent turns:\n${turns.join("\n\n")}`);
  }

  const text = sections.join("\n\n") || "(The thread has no visible messages yet.)";

  return {
    text,
    tokens: estimateTokenCountSync(text),
    includedMessages: turns.length,
    totalMessages: messages.length,
  };
}

export async function loadBtwContextSnapshot(
  loaders: BtwContextLoaders
): Promise<BtwContextSnapshot> {
  const [summary, messages] = await Promise.all([loaders.loadSummary(), loaders.loadMessages()]);

  return buildBtwSnapshotText(summary, messages ?? []);
}

export const BTW_SYSTEM_PROMPT = `You are answering a quick side question ("by the way") that the user asked while in the middle of a longer conversation.

You are given a compact snapshot of that conversation: its running summary and its most recent turns. Use it for context only. The snapshot may be partial.

- Answer the side question directly and concisely.
- Do not continue, redo, or summarize the main conversation unless the question asks for it.
- If the answer depends on something the snapshot does not show, say what you'd need.
- You have no tools in this side thread.`;
