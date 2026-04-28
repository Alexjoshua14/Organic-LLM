import type { UIMessage } from "ai";

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
