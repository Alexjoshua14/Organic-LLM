import type { UIMessage } from "ai";
import type { ShowcaseTrace } from "./showcase-trace";

export function buildAnatomyUserMessage(prompt: string): UIMessage {
  return {
    id: "showcase-user",
    role: "user",
    parts: [{ type: "text", text: prompt }],
  };
}

/**
 * Assistant row for the anatomy demo: tool cards (frozen outputs) plus a text part
 * whose `state` follows the simulated stream.
 */
export function buildAnatomyAssistantMessage(
  trace: ShowcaseTrace,
  streamedText: string,
  streamComplete: boolean
): UIMessage {
  const toolParts = trace.finalResponse.toolCards.map((card, i) => ({
    type: "dynamic-tool" as const,
    toolName: card.toolName,
    toolCallId: `showcase-${card.toolName}-${i}`,
    state: "output-available" as const,
    input: {},
    output: card.displayBody,
  }));

  const textPart = {
    type: "text" as const,
    text: streamedText,
    state: streamComplete ? ("done" as const) : ("streaming" as const),
  };

  return {
    id: "showcase-assistant",
    role: "assistant",
    parts: [...toolParts, textPart],
  };
}
