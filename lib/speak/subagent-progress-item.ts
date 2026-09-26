/**
 * Silent progress injection for a live Speak Realtime session scoped to a subagent.
 *
 * Distinct from ambient screen context ({@link buildAmbientContextItem}): this is
 * *work progress*, not "what the user is looking at". Same transport shape (system
 * item, no `response.create`) so the model updates context without speaking.
 */

import type { RealtimeClientEvent } from "@/lib/speak/ambient-item";

export const SUBAGENT_PROGRESS_PREFACE =
  "[subagent progress — silent context] Background work update only. Do not speak, " +
  "acknowledge, or announce this. Do not change the conversation topic. Fold it into " +
  "your understanding of this subagent's current progress; wait for the user or a " +
  "milestone before saying anything.";

export function formatSubagentProgressBody(args: {
  agentId: string;
  role?: string;
  name?: string;
  progress: string;
}): string {
  const who = [args.name, args.role ? `(${args.role})` : null].filter(Boolean).join(" ");
  const label = who || args.agentId;

  return `Subagent ${label} [${args.agentId}] progress:\n${args.progress.trim()}`;
}

/**
 * Builds the `conversation.item.create` event. Returns `null` for empty bodies.
 * Callers must not follow with `response.create`.
 */
export function buildSubagentProgressItem(body: string): RealtimeClientEvent | null {
  const trimmed = body.trim();

  if (!trimmed) return null;

  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [{ type: "input_text", text: `${SUBAGENT_PROGRESS_PREFACE}\n\n${trimmed}` }],
    },
  };
}
