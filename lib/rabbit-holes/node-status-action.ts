"use server";

import type { RabbitHoleNodeStatus } from "./node-status";

import { resolveRabbitHoleNodeStatus } from "./node-status";

import { supabaseServer } from "@/lib/supabase/server";

const MAX_ID_LENGTH = 128;

/**
 * Generation status (and key points, once written) for one node, for the chat card that
 * created it. Two narrow reads, overlapped — never the whole session, its articles or sources.
 * The client is RLS-scoped to the signed-in user, so another user's ids return nothing.
 *
 * `null` means unreadable or not found.
 */
export async function getRabbitHoleNodeStatus(
  sessionId: string,
  nodeId: string
): Promise<RabbitHoleNodeStatus | null> {
  if (
    typeof sessionId !== "string" ||
    typeof nodeId !== "string" ||
    !sessionId ||
    !nodeId ||
    sessionId.length > MAX_ID_LENGTH ||
    nodeId.length > MAX_ID_LENGTH
  ) {
    return null;
  }

  const supabase = await supabaseServer();
  const [sessionRes, nodeRes] = await Promise.all([
    supabase
      .from("rabbit_hole_sessions")
      .select("generating_node_id, generation_step, updated_at")
      .eq("session_id", sessionId)
      .maybeSingle(),
    supabase
      .from("rabbit_hole_nodes")
      .select("key_takeaways")
      .eq("session_id", sessionId)
      .eq("node_id", nodeId)
      .maybeSingle(),
  ]);

  if (sessionRes.error || nodeRes.error || !sessionRes.data || !nodeRes.data) return null;

  return resolveRabbitHoleNodeStatus(nodeId, sessionRes.data, nodeRes.data, Date.now());
}
