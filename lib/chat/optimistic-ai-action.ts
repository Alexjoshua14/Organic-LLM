import type { ChatStatus, UIMessage } from "ai";
import type { ExaSearchResultSource } from "@/lib/exa/types";

import { ChatAIActionEnum } from "@/types/ai";

/** First-paint receipt shown locally as soon as the user message is in the thread. */
export const OPTIMISTIC_MESSAGE_RECEIVED_LABEL = "Reading...";

export type ThreadAiActionPayload = {
  action: ChatAIActionEnum;
  message?: string;
  sources?: ExaSearchResultSource[];
};

export function optimisticMessageReceivedAction(): ThreadAiActionPayload {
  return {
    action: ChatAIActionEnum.Processing,
    message: OPTIMISTIC_MESSAGE_RECEIVED_LABEL,
  };
}

export type ThreadLiveAiActionPlacement = "last-message" | "after-user" | "none";

export type ThreadLiveAiAction = {
  payload: ThreadAiActionPayload | undefined;
  placement: ThreadLiveAiActionPlacement;
};

/**
 * Where the live processing tail belongs for the current turn.
 *
 * Stream `data-aiAction` events only arrive after the network round-trip, and
 * `ChatMessage` only renders that tail on assistant rows. While the last row is
 * still the user bubble, show an optimistic receipt from `useChat` status so the
 * first paint stays on-device (sub-250ms, independent of connection speed).
 *
 * The stream's `start` chunk creates the assistant message before it has any parts, and
 * `ChatThread` renders no row for it yet. Until it does, the tail stays standalone so the
 * status survives the seconds of context gathering before the first token.
 */
export function resolveThreadLiveAiAction(input: {
  lastMessageRole: UIMessage["role"] | undefined;
  /** False while the last message has no parts `ChatThread` would render a row for. */
  lastMessageHasContent?: boolean;
  status?: ChatStatus;
  aiActionPayload?: ThreadAiActionPayload;
}): ThreadLiveAiAction {
  const { lastMessageRole, lastMessageHasContent = true, status, aiActionPayload } = input;

  if (lastMessageRole === "assistant" && lastMessageHasContent) {
    return aiActionPayload
      ? { payload: aiActionPayload, placement: "last-message" }
      : { payload: undefined, placement: "none" };
  }

  if (aiActionPayload) {
    return { payload: aiActionPayload, placement: "after-user" };
  }

  if (lastMessageRole && (status === "submitted" || status === "streaming")) {
    return {
      payload: optimisticMessageReceivedAction(),
      placement: "after-user",
    };
  }

  return { payload: undefined, placement: "none" };
}
