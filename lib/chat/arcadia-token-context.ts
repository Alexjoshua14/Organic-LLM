import type { UIMessage } from "ai";

import {
  estimateTokenCountSync,
  getMessageTextForTokenEstimate,
} from "@/lib/chat/context-budget";

/** Max tokens of thread message history sent to the model (Arcadia token-window prototype). */
export const ARCADIA_MESSAGE_TOKEN_BUDGET = 50_000;

/** Pinned messages may consume at most this fraction of {@link ARCADIA_MESSAGE_TOKEN_BUDGET}. */
export const ARCADIA_PINNED_BUDGET_RATIO = 0.2;

/** Always keep at least this many recent non-summary messages after condensation. */
export const ARCADIA_MIN_RECENT_MESSAGES = 4;

/** Hard ceiling for a single core-input LLM call (system + tools + messages + draft). */
export const HARD_MAX_LLM_INPUT_TOKENS = 300_000;

export type ArcadiaMessageMetadata = {
  pinned?: boolean;
};

export type ArcadiaMessageSelection = {
  contextMessages: UIMessage[];
  contextMessageTokens: number;
  messagesToCondense: UIMessage[];
  pinnedCount: number;
  pinnedTokens: number;
  recentCount: number;
  totalThreadMessages: number;
  needsCondensation: boolean;
};

export function isPinnedContextMessage(message: UIMessage): boolean {
  const metadata = message.metadata as ArcadiaMessageMetadata | undefined;

  return metadata?.pinned === true;
}

export function sumMessagesTokens(messages: UIMessage[]): number {
  return messages.reduce((total, message) => {
    const text = getMessageTextForTokenEstimate(message);

    return total + (text ? estimateTokenCountSync(text) : 0);
  }, 0);
}

function messageTokenCount(message: UIMessage): number {
  const text = getMessageTextForTokenEstimate(message);

  return text ? estimateTokenCountSync(text) : 0;
}

/**
 * Select Arcadia history for the next turn:
 * - pinned messages (newest-first trim, capped at 20% of budget)
 * - recent tail (at least {@link ARCADIA_MIN_RECENT_MESSAGES}, fills remaining budget)
 * - older non-kept messages are candidates for condensation
 */
export function selectArcadiaContextMessages(
  allMessages: UIMessage[],
  options?: {
    tokenBudget?: number;
    pinnedBudgetRatio?: number;
    minRecentCount?: number;
  }
): ArcadiaMessageSelection {
  const tokenBudget = options?.tokenBudget ?? ARCADIA_MESSAGE_TOKEN_BUDGET;
  const pinnedBudget = Math.floor(tokenBudget * (options?.pinnedBudgetRatio ?? ARCADIA_PINNED_BUDGET_RATIO));
  const minRecentCount = options?.minRecentCount ?? ARCADIA_MIN_RECENT_MESSAGES;

  const totalThreadMessages = allMessages.length;
  const totalThreadTokens = sumMessagesTokens(allMessages);

  if (totalThreadMessages === 0) {
    return {
      contextMessages: [],
      contextMessageTokens: 0,
      messagesToCondense: [],
      pinnedCount: 0,
      pinnedTokens: 0,
      recentCount: 0,
      totalThreadMessages: 0,
      needsCondensation: false,
    };
  }

  const pinnedChronological = allMessages.filter(isPinnedContextMessage);
  const pinnedNewestFirst = [...pinnedChronological].reverse();

  const keptPinned: UIMessage[] = [];
  let pinnedTokens = 0;

  for (const message of pinnedNewestFirst) {
    const tokens = messageTokenCount(message);

    if (pinnedTokens + tokens > pinnedBudget && keptPinned.length > 0) {
      break;
    }

    if (tokens > pinnedBudget) {
      continue;
    }

    pinnedTokens += tokens;
    keptPinned.push(message);
  }

  keptPinned.reverse();

  const keptPinnedIds = new Set(keptPinned.map((message) => message.id));
  const nonPinned = allMessages.filter((message) => !keptPinnedIds.has(message.id));

  let remainingBudget = Math.max(0, tokenBudget - pinnedTokens);
  const recentTail: UIMessage[] = [];
  let recentTokens = 0;

  for (let index = nonPinned.length - 1; index >= 0; index -= 1) {
    const message = nonPinned[index]!;
    const tokens = messageTokenCount(message);
    const isBelowMinRecent = recentTail.length < minRecentCount;

    if (!isBelowMinRecent && recentTokens + tokens > remainingBudget) {
      break;
    }

    recentTail.unshift(message);
    recentTokens += tokens;
  }

  const contextMessages = [...keptPinned, ...recentTail];
  const contextMessageTokens = pinnedTokens + recentTokens;
  const keptIds = new Set(contextMessages.map((message) => message.id));
  const messagesToCondense = allMessages.filter((message) => !keptIds.has(message.id));

  const needsCondensation =
    totalThreadTokens > tokenBudget && messagesToCondense.length > 0;

  return {
    contextMessages,
    contextMessageTokens,
    messagesToCondense,
    pinnedCount: keptPinned.length,
    pinnedTokens,
    recentCount: recentTail.length,
    totalThreadMessages,
    needsCondensation,
  };
}
