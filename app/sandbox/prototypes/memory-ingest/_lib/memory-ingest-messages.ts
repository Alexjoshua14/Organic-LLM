import { getToolOrDynamicToolName, isToolUIPart, type UIMessage } from "ai";

import { RENDER_GEN_UI_TOOL_NAME } from "@/lib/llm/gen-ui-tool";

export type MemoryIngestGenUIPart = {
  /** Stable render key: message id + part index. */
  key: string;
  messageId: string;
  partIndex: number;
  output: unknown;
};

/**
 * Completed `render_gen_ui` outputs on the **latest assistant message** — the
 * delivery slot renders only the current turn's visual, mirroring how the caption
 * shows only the latest reply.
 */
export function lastAssistantGenUIParts(messages: UIMessage[]): MemoryIngestGenUIPart[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];

    if (m.role !== "assistant") continue;
    const out: MemoryIngestGenUIPart[] = [];

    (m.parts ?? []).forEach((p, partIndex) => {
      if (!isToolUIPart(p)) return;
      if (getToolOrDynamicToolName(p) !== RENDER_GEN_UI_TOOL_NAME) return;
      if (p.state !== "output-available") return;
      out.push({ key: `${m.id}-${partIndex}`, messageId: m.id, partIndex, output: p.output });
    });

    return out;
  }

  return [];
}

/** Last assistant message plain text (for capped ritual reply under particles). */
export function lastAssistantPlaintext(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];

    if (m.role !== "assistant") continue;
    const parts = m.parts ?? [];
    const chunks: string[] = [];

    for (const p of parts) {
      if (p.type === "text" && "text" in p && typeof (p as { text?: string }).text === "string") {
        chunks.push((p as { text: string }).text);
      }
    }
    const out = chunks.join("").trim();

    if (out) return out;
  }

  return "";
}
