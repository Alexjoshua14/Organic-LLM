import type { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

/**
 * An empty session: no nodes, no root. Shared by the client hook and the server-side
 * rabbit hole toolset so both start sessions from the same shape.
 */
export function buildEmptyRabbitHoleSession({
  sessionId,
  now = new Date().toISOString(),
}: {
  sessionId: string;
  now?: string;
}): RabbitHoleSession {
  return {
    sessionId,
    rootQuestion: "",
    activeNodeId: null,
    createdAt: now,
    updatedAt: now,
    path: [],
    nodesById: {},
    edges: [],
  };
}
