/**
 * Returns how much of the context has been used up so far
 *
 * Can be based on a dynamic/externally set limit and/or tracker
 * API to rest of Organic LLM remains unchange based on this file's internals
 */

import { randomInt } from "crypto";

interface getContextLimitProps {
  chatId: string;
}

interface ContextLimitResult {
  limit: number;
  used: number;
  remaining: number;
  warning?: ContextLimitWarning;
  error?: ContextLimitError;
}

interface CheckContextProps {
  chatId: string;
  limit: number;
  used: number;
  remaining: number;
}

type ContextLimitWarning = {
  low?: {
    percentUsed: number;
    message: string;
  };
  medium?: {
    percentUsed: number;
    message: string;
  };
  high?: {
    percentUsed: number;
    message: string;
  };
};

/** Any custom error handling data we need in here */
interface ContextLimitError extends Error {
  message: string;
  code: string;
}

const default_warning_messages: Record<keyof ContextLimitWarning, string> = {
  low: "You are approaching the context limit. Please consider summarizing your conversation or using a different model.",
  medium:
    "You are approaching the context limit. Please consider summarizing your conversation or using a different model.",
  high: "You are approaching the context limit. Please consider summarizing your conversation or using a different model.",
};

/**
 * Default context limit in tokens.
 */
const DEFAULT_CONTEXT_LIMIT = 40_000;

/**
 * Default warning trigger percentage
 */
const DEFAULT_WARNING_THRESHOLD = 0.8;

/**
 * Returns how much of the context has been used up so far.
 *
 * @param chatId - The ID of the chat to get the context limit for
 * @returns The context limit for the chat
 * @property {number} limit - The maximum number of context tokens or items allowed for the chat.
 * @property {number} used - The number of context tokens or items used so far.
 * @property {number} remaining - The number of context tokens or items remaining.
 */
export const getContextLimit = ({
  chatId,
}: getContextLimitProps): ContextLimitResult => {
  const default_result: ContextLimitResult = {
    limit: DEFAULT_CONTEXT_LIMIT,
    used: 0,
    remaining: randomInt(0, DEFAULT_CONTEXT_LIMIT),
  };

  const processed_result = checkContext({
    ...default_result,
    chatId,
  });

  return processed_result;
};

const checkContext = ({
  chatId,
  limit,
  used,
  remaining,
}: CheckContextProps): ContextLimitResult => {
  let default_result: ContextLimitResult = {
    limit: limit,
    used: used,
    remaining: remaining,
  };

  /** Check for invalid states */
  if (limit < 0 || used < 0 || remaining < 0) {
    default_result.error = {
      name: "InvalidContextLimitStateError",
      message: "Invalid context limit state",
      stack: new Error().stack,
      code: "INVALID_CONTEXT_LIMIT_STATE",
    };

    return default_result;
  }
  if (limit < used) {
    default_result.error = {
      name: "InvalidContextLimitStateError",
      message: "Invalid context limit state",
      stack: new Error().stack,
      code: "INVALID_CONTEXT_LIMIT_STATE",
    };

    return default_result;
  }

  if (remaining < 0) {
    default_result.error = {
      name: "InvalidContextLimitStateError",
      message: "Invalid context limit state",
      stack: new Error().stack,
      code: "INVALID_CONTEXT_LIMIT_STATE",
    };

    return default_result;
  }

  /** Check for threshold warnings */
  const percentUsed = used / limit;

  if (percentUsed > DEFAULT_WARNING_THRESHOLD) {
    default_result.warning = {
      high: {
        percentUsed: percentUsed,
        message: default_warning_messages.high,
      },
    };
  }

  return default_result;
};
