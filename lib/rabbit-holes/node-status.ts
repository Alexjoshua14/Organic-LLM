import type { RabbitHoleStep } from "@/lib/sidebar/session-signal";

import { isRabbitHoleStep } from "@/lib/sidebar/session-signal";
import { SESSION_WORKING_STALE_MS } from "@/lib/sidebar/session-signal-timing";

const MAX_KEY_POINTS = 6;

/**
 * Scheduling stores these on a node before its article exists (scheduleNodeGeneration pads key
 * takeaways to satisfy the session schema). They are not key points.
 */
const PLACEHOLDER_KEY_POINTS = new Set(["Generating…", "…"]);

/**
 * Where one rabbit-hole node's generation stands, for the chat card that created it.
 *
 * - `working`: this node is being generated. `branch_suggestions` means the article is
 *   already written (key points are available); only branch ideas remain.
 * - `ready`: generation has moved on and the article has its key points.
 * - `stalled`: still marked as generating, but nothing has moved for longer than the sidebar's
 *   stale threshold, so the card and the sidebar agree.
 * - `unknown`: not generating and no key points: an older or failed node. The card stops
 *   claiming progress rather than guess.
 */
export type RabbitHoleNodeStatus =
  | { state: "working"; step: RabbitHoleStep | null; keyPoints: string[] }
  | { state: "ready"; keyPoints: string[] }
  | { state: "stalled" }
  | { state: "unknown" };

export type RabbitHoleSessionStatusRow = {
  generating_node_id: string | null;
  generation_step: string | null;
  updated_at: string | null;
};

export function resolveRabbitHoleNodeStatus(
  nodeId: string,
  session: RabbitHoleSessionStatusRow,
  node: { key_takeaways: unknown },
  now: number
): RabbitHoleNodeStatus {
  const keyPoints = Array.isArray(node.key_takeaways)
    ? node.key_takeaways
        .filter(
          (point): point is string =>
            typeof point === "string" && !!point.trim() && !PLACEHOLDER_KEY_POINTS.has(point.trim())
        )
        .slice(0, MAX_KEY_POINTS)
    : [];

  if (session.generating_node_id === nodeId) {
    const updated = session.updated_at ? Date.parse(session.updated_at) : Number.NaN;

    if (!Number.isNaN(updated) && now - updated > SESSION_WORKING_STALE_MS) {
      return { state: "stalled" };
    }

    return {
      state: "working",
      step: isRabbitHoleStep(session.generation_step) ? session.generation_step : null,
      keyPoints,
    };
  }

  return keyPoints.length > 0 ? { state: "ready", keyPoints } : { state: "unknown" };
}
