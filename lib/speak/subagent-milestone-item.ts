/**
 * Milestone announcement for a live Speak Realtime session scoped to a subagent.
 *
 * Distinct from silent progress ({@link buildSubagentProgressItem}): the client
 * *must* follow this item with `response.create` so the model speaks. Prefaces
 * make the announce-vs-silent contract explicit in the transcript.
 */

import type { RealtimeClientEvent } from "@/lib/speak/ambient-item";

export const SUBAGENT_MILESTONE_PREFACE =
  "[subagent milestone — announce] A milestone was reached for the subagent you are " +
  "voicing. Speak a brief, natural announcement of this milestone to the user now. " +
  "Do not invent other progress. Do not narrate ordinary background updates — only " +
  "this milestone.";

export function formatSubagentMilestoneBody(args: {
  agentId: string;
  role?: string;
  name?: string;
  milestone: string;
  progress?: string;
}): string {
  const who = [args.name, args.role ? `(${args.role})` : null].filter(Boolean).join(" ");
  const label = who || args.agentId;
  const lines = [`Subagent ${label} [${args.agentId}] milestone:`, args.milestone.trim()];

  if (args.progress?.trim()) {
    lines.push("", "Current progress snapshot:", args.progress.trim());
  }

  return lines.join("\n");
}

/**
 * Builds the `conversation.item.create` event. Returns `null` for empty bodies.
 * Callers **must** send `response.create` after this so the model announces.
 */
export function buildSubagentMilestoneItem(body: string): RealtimeClientEvent | null {
  const trimmed = body.trim();

  if (!trimmed) return null;

  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "system",
      content: [{ type: "input_text", text: `${SUBAGENT_MILESTONE_PREFACE}\n\n${trimmed}` }],
    },
  };
}
