import type { UIMessage } from "ai";

/**
 * Visible prose only: tool calls, reasoning, and data parts stay out of a side question. Kept
 * apart from `btw-context`, which loads the tokenizer, so the btw panel can use it.
 */
export function messagePlainText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
}
