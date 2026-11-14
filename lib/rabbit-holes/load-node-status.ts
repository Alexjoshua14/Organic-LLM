import type { RabbitHoleNodeStatus } from "./node-status";

/**
 * Client entry for the node-status server action. Imported lazily so chat rendering (and its
 * tests) never pulls the Supabase/Clerk chain until a creation card actually reads.
 */
export async function loadRabbitHoleNodeStatus(
  sessionId: string,
  nodeId: string
): Promise<RabbitHoleNodeStatus | null> {
  const { getRabbitHoleNodeStatus } = await import("./node-status-action");

  return getRabbitHoleNodeStatus(sessionId, nodeId);
}
