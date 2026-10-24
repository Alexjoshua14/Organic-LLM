import type { UIMessage } from "ai";

export const FOLDED_SYSTEM_NOTICE_PREFIX = "[System notice — written by Organic LLM, not the user]";

/**
 * Persisted `system` rows (e.g. Jev heartbeat notices) sit between user and assistant turns.
 * Providers disagree on system messages mid-history — some reject them outright — and the turn's
 * real system prompt travels separately. Hand them to the model as clearly labelled user-role
 * notices instead; the stored rows stay `system` for the UI.
 */
export function foldSystemNoticesForModel<M extends UIMessage>(messages: ReadonlyArray<M>): M[] {
  return messages.map((message) => {
    if (message.role !== "system") return message;

    const [first, ...rest] = message.parts;
    const parts =
      first?.type === "text"
        ? [{ ...first, text: `${FOLDED_SYSTEM_NOTICE_PREFIX}\n${first.text}` }, ...rest]
        : [{ type: "text" as const, text: FOLDED_SYSTEM_NOTICE_PREFIX }, ...message.parts];

    return { ...message, role: "user", parts } as M;
  });
}
