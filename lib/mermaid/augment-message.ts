import type { UIMessage } from "ai";

import { formatDiagramNodeContext } from "@/lib/mermaid/node-graph";
import type { DiagramNodeLink } from "@/lib/mermaid/types";

/** Prepend compact diagram-node context to the outgoing user message for the model. */
export function augmentUserMessageWithDiagramLinks(
  message: UIMessage,
  links: DiagramNodeLink[] | undefined
): UIMessage {
  if (!links?.length) return message;

  const context = links.map((link) => formatDiagramNodeContext(link)).join("\n\n");
  const prefix = `${context}\n\n---\n\n`;

  const parts = message.parts.map((part) => ({ ...part }));

  const firstTextIdx = parts.findIndex((p) => p.type === "text");

  if (firstTextIdx >= 0) {
    const textPart = parts[firstTextIdx];

    if (textPart.type === "text") {
      parts[firstTextIdx] = { ...textPart, text: prefix + textPart.text };
    }
  } else {
    parts.unshift({ type: "text", text: prefix.trimEnd() });
  }

  return { ...message, parts };
}
