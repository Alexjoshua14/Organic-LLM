/**
 * Client entry for the key-points server action. Imported lazily so chat rendering (and its
 * tests) never pulls the Supabase/Clerk chain until someone opens a card's key points.
 */
export async function loadRabbitHoleKeyPoints(
  sessionId: string,
  nodeId: string
): Promise<string[] | null> {
  const { getRabbitHoleKeyPoints } = await import("./key-points");

  return getRabbitHoleKeyPoints(sessionId, nodeId);
}
