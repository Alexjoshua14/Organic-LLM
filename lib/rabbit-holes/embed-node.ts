import "server-only";

/**
 * Placeholder for future vector embeddings on node generation.
 * Phase 3 hooks generation pipeline to persist embeddings when infra is available.
 */
export async function embedRabbitHoleNode(_params: {
  sessionId: string;
  nodeId: string;
  ownerId: string;
  text: string;
}): Promise<{ ok: boolean }> {
  return { ok: true };
}
