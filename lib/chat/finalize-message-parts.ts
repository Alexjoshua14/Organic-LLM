import type { UIMessage } from "ai";

/**
 * Marks text and reasoning parts still flagged `streaming` as `done`.
 * The AI SDK leaves open parts as-is when a stream aborts or errors before their `*-end`
 * chunk, so a saved turn would otherwise read as in-flight forever after reload.
 */
export function finalizeStreamingParts<T extends UIMessage>(message: T): T {
  if (
    !message.parts.some(
      (part) => (part.type === "text" || part.type === "reasoning") && part.state === "streaming"
    )
  ) {
    return message;
  }

  return {
    ...message,
    parts: message.parts.map((part) =>
      (part.type === "text" || part.type === "reasoning") && part.state === "streaming"
        ? { ...part, state: "done" as const }
        : part
    ),
  };
}
