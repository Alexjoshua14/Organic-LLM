"use server";

import { supabaseServer } from "@/lib/supabase/server";

const MAX_ID_LENGTH = 128;
const MAX_KEY_POINTS = 6;

/**
 * One node's key takeaways, for the chat card's key-points disclosure. Reads a single
 * column instead of the whole session (articles, sources, branches). The client is
 * RLS-scoped to the signed-in user, so another user's ids return nothing.
 *
 * `null` means unreadable; `[]` means the article has not been written yet.
 */
export async function getRabbitHoleKeyPoints(
  sessionId: string,
  nodeId: string
): Promise<string[] | null> {
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
  const { data, error } = await supabase
    .from("rabbit_hole_nodes")
    .select("key_takeaways")
    .eq("session_id", sessionId)
    .eq("node_id", nodeId)
    .maybeSingle();

  if (error || !data) return null;

  const points: unknown = data.key_takeaways;

  return Array.isArray(points)
    ? points
        .filter((point): point is string => typeof point === "string" && !!point.trim())
        .slice(0, MAX_KEY_POINTS)
    : [];
}
