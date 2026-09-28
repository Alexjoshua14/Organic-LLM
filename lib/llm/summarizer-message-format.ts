import type { ModelMessage, UIMessage } from "ai";

/** Max length for tool result snippet in converted text (avoid huge payloads). */
const TOOL_RESULT_TEXT_MAX_LEN = 600;

/**
 * Newer Gemini models (e.g. google/gemini-3.8-flash via Vertex) reject requests whose
 * contents end on a model/assistant turn. After a completed chat exchange the history
 * normally ends on the assistant — append a short user cue so generateText/generateObject
 * stay valid. Idempotent when the last turn is already user.
 */
export function ensureModelMessagesEndWithUserTurn(
  messages: ModelMessage[],
  cue = "Please continue with the task described in the system instructions."
): ModelMessage[] {
  if (messages.length === 0) {
    return [{ role: "user", content: cue }];
  }

  const last = messages[messages.length - 1];

  if (last?.role === "user") {
    return messages;
  }

  return [...messages, { role: "user", content: cue }];
}

/**
 * Converts tool-invocation parts to text parts so the summarizer sees tool semantics
 * without sending structured functionCall parts (avoids Gemini thought_signature requirement).
 * Preserves: tool name, args, and result/error in plain text.
 */
export function convertToolCallsToTextForSummarizer(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    const parts = msg.parts ?? [];
    const newParts: Array<{ type: "text"; text: string }> = [];

    for (const part of parts) {
      if (part.type === "text" && "text" in part) {
        newParts.push({ type: "text", text: (part as { text: string }).text });
        continue;
      }
      if (part.type === "tool-invocation" || (part.type && String(part.type).startsWith("tool-"))) {
        const p = part as unknown as {
          toolName?: string;
          toolCallId?: string;
          args?: unknown;
          input?: unknown;
          state: string;
          result?: unknown;
          output?: unknown;
          errorText?: string;
        };
        const name = p.toolName ?? p.toolCallId ?? "tool";
        const argsLike = p.args ?? p.input;
        const argsStr = argsLike !== undefined ? JSON.stringify(argsLike) : "";
        let snippet = `[Tool: ${name}${argsStr ? ` with args: ${argsStr}` : ""}.`;
        const resultLike = p.result ?? p.output;

        if (p.state === "result" && resultLike !== undefined) {
          const resultStr =
            typeof resultLike === "string" ? resultLike : JSON.stringify(resultLike);

          snippet += ` Result: ${resultStr.slice(0, TOOL_RESULT_TEXT_MAX_LEN)}${resultStr.length > TOOL_RESULT_TEXT_MAX_LEN ? "…" : ""}`;
        } else if (p.state === "output-error" && p.errorText) {
          snippet += ` Error: ${p.errorText.slice(0, 200)}`;
        } else {
          snippet += ` State: ${p.state}`;
        }
        snippet += "]";
        newParts.push({ type: "text", text: snippet });
      }
    }

    if (newParts.length === 0) {
      return {
        ...msg,
        parts: [{ type: "text" as const, text: "[No text or tool output in this message]" }],
      };
    }

    return { ...msg, parts: newParts };
  });
}
