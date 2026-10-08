import type { SubagentBoardPayload } from "@/lib/arcadia/multitask/board-sync";

import { NextResponse } from "next/server";

import {
  getSubagentThreadLink,
  listSubagentThreadRows,
  readThreadMessagesWithAdmin,
} from "@/data/supabase/subagent-threads";
import { requireOwnedThread } from "@/lib/api/require-owned-thread";
import {
  buildSubagentThreadSnapshot,
  SUBAGENT_SNAPSHOT_MESSAGE_WINDOW,
} from "@/lib/llm/subagents/threads/snapshot";

export const maxDuration = 15;

/**
 * GET /api/chat/[id]/arcadia/subagents
 *
 * The multitask board for an orchestrator thread: one entry per subagent thread with its
 * effective status and short excerpts. Called with a subagent thread id, answers for that
 * thread's orchestrator so the board shows siblings.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: chatId } = await params;
  const gate = await requireOwnedThread(chatId);

  if (!gate.ok) return gate.response;

  const ownerId = gate.actor.sbUserId;
  const link = await getSubagentThreadLink(chatId, ownerId);
  const orchestratorThreadId = link?.parentThreadId ?? chatId;
  const rows = await listSubagentThreadRows(orchestratorThreadId, ownerId);
  const now = Date.now();
  const subagents = await Promise.all(
    rows.map(async (row) => {
      const snapshot = buildSubagentThreadSnapshot(
        row,
        await readThreadMessagesWithAdmin({
          threadId: row.threadId,
          ownerId,
          limit: SUBAGENT_SNAPSHOT_MESSAGE_WINDOW,
        }),
        now
      );

      return {
        agentId: snapshot.agentId,
        threadId: snapshot.threadId,
        name: snapshot.name,
        role: snapshot.role,
        status: snapshot.status,
        statusAt: snapshot.statusAt,
        goal: snapshot.lastGoal,
        outcome: snapshot.lastOutcome,
      };
    })
  );

  const payload: SubagentBoardPayload = { orchestratorThreadId, subagents };

  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
