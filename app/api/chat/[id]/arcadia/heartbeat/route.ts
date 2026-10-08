import { after, NextResponse } from "next/server";

import {
  appendThreadMessagesWithAdmin,
  claimSubagentHeartbeat,
  completeSubagentHeartbeat,
  getSubagentHeartbeatState,
  getSubagentThreadLink,
  listSubagentThreadRows,
  readThreadMessagesWithAdmin,
} from "@/data/supabase/subagent-threads";
import { requireOwnedThread } from "@/lib/api/require-owned-thread";
import { runSubagentHeartbeat } from "@/lib/llm/subagents/heartbeat/run-heartbeat";
import { createLogger } from "@/lib/logger";
import { recordGatewayCallUsage } from "@/lib/usage/record-gateway-call";

import { z } from "zod";
import { insertQueuedMessage } from "@/data/supabase/message-send-queue";
import { tryDispatchThreadQueue } from "@/lib/message-queue/dispatch";
import { getPlanBudgetForUser } from "@/lib/plans/monthly-budget";
import { MessageSendQueuePayloadSchema } from "@/lib/schemas/message-send-queue";

export const maxDuration = 300;
const HeartbeatRequestSchema = z.object({
  preferences: MessageSendQueuePayloadSchema.optional(),
});

const logger = createLogger("app/api/chat/[id]/arcadia/heartbeat/route.ts");

/**
 * POST /api/chat/[id]/arcadia/heartbeat
 *
 * One Jev heartbeat for an orchestrator thread, sent by the client on the user's Background
 * activity cadence while the thread is in view. When Jev judges the subagent board changed in a
 * way the orchestrator must know, the response carries the system message it posted into the
 * orchestrator's thread.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orchestratorThreadId } = await params;
  const gate = await requireOwnedThread(orchestratorThreadId);

  if (!gate.ok) return gate.response;

  const body = HeartbeatRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  const ownerId = gate.actor.sbUserId;
  const dispatchArgs = { ownerId, clerkUserId: gate.actor.clerkUserId, threadId: orchestratorThreadId };
  const budget = await getPlanBudgetForUser({ ownerId, clerkUserId: gate.actor.clerkUserId });
  if (!budget.canDispatch) return NextResponse.json({ status: "blocked-budget" });

  if (await getSubagentThreadLink(orchestratorThreadId, ownerId)) {
    return NextResponse.json(
      { error: "Heartbeats run on the orchestrator thread, not a subagent thread" },
      { status: 400 }
    );
  }

  const outcome = await runSubagentHeartbeat({
    ownerId,
    deps: {
      listChildren: () => listSubagentThreadRows(orchestratorThreadId, ownerId),
      loadMessages: (threadId, limit) => readThreadMessagesWithAdmin({ threadId, ownerId, limit }),
      getState: () => getSubagentHeartbeatState(orchestratorThreadId, ownerId),
      claim: ({ previousAt, at }) =>
        claimSubagentHeartbeat({ threadId: orchestratorThreadId, ownerId, previousAt, at }),
      complete: (state) =>
        completeSubagentHeartbeat({ threadId: orchestratorThreadId, ownerId, ...state }),
      enqueueReply: async (message) => {
        const item = await insertQueuedMessage({
          id: message.id,
          ownerId,
          threadId: orchestratorThreadId,
          body: "Review the latest subagent update.",
          payload: {
            ...body.data.preferences,
            experience: "arcadia",
            heartbeatMessageId: message.id,
          },
        });
        if (!item) throw new Error("Could not queue automatic reply");
      },
      appendSystemMessage: (message) =>
        appendThreadMessagesWithAdmin({
          threadId: orchestratorThreadId,
          ownerId,
          messages: [message],
        }),
      recordUsage: ({ modelId, usage, providerMetadata }) =>
        recordGatewayCallUsage({
          ownerId,
          modelId,
          usage,
          providerMetadata,
          operation: "subagent_heartbeat",
          route: "/api/chat/[id]/arcadia/heartbeat",
        }),
    },
  });

  if (outcome.status === "error") {
    logger.error("POST", `heartbeat failed: ${outcome.error}`);

    return NextResponse.json({ status: "error" }, { status: 502 });
  }

  // Also resumes a reply held by an earlier user stream or temporary budget block.
  after(async () => {
    const children = await listSubagentThreadRows(orchestratorThreadId, ownerId);
    await Promise.all([
      tryDispatchThreadQueue(dispatchArgs),
      ...children.map((child) => tryDispatchThreadQueue({ ...dispatchArgs, threadId: child.threadId })),
    ]);
  });
  return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
}
