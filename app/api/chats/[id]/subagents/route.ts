import { GET as getArcadiaSubagents } from "@/app/api/chat/[id]/arcadia/subagents/route";

export const maxDuration = 15;

/**
 * GET /api/chats/[id]/subagents
 *
 * Returns the subagent mesh snapshot for a thread (Rabbit Hole or Arcadia orchestrator).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return getArcadiaSubagents(req, { params: Promise.resolve({ id }) });
}
