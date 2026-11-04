import "server-only";

import type { EnqueueMessageInput, MessageSendQueueRow } from "@/lib/schemas/message-send-queue";

import {
  acquireChatStreamLease,
  acquireSubagentStreamLease,
  type StreamAdmission,
} from "@/lib/chat/stream-admission";

import {
  claimNextQueuedMessage,
  getThreadActiveStreamId,
  insertQueuedMessage,
  listBlockedSubagentThreadIds,
  listOpenQueuedMessages,
  releaseClaimedMessage,
  reserveThreadStream,
  releaseThreadStream,
  updateQueuedMessageStatus,
} from "@/data/supabase/message-send-queue";
import { createLogger } from "@/lib/logger";
import { evaluateDispatchGates } from "@/lib/message-queue/dispatch-gates";
import { runQueuedChatTurn } from "@/lib/message-queue/run-queued-chat-turn";
import { getPlanBudgetForUser } from "@/lib/plans/plan-budget";

const logger = createLogger("lib/message-queue/dispatch.ts");

/** In-process lock so overlapping after()/route calls don't double-claim. */
const dispatchingThreads = new Set<string>();

export type EnqueueResult = {
  item: MessageSendQueueRow;
  /** Snapshot after enqueue + one dispatch attempt. */
  openQueue: MessageSendQueueRow[];
  budget: Awaited<ReturnType<typeof getPlanBudgetForUser>>;
};

/**
 * Persist a multi-mode message, then attempt server dispatch.
 * Enqueue never blocks on streaming or budget — those only hold dispatch.
 */
export async function enqueueAndTryDispatch(args: {
  ownerId: string;
  clerkUserId: string;
  input: EnqueueMessageInput;
}): Promise<EnqueueResult | { error: string }> {
  const { ownerId, clerkUserId, input } = args;

  const item = await insertQueuedMessage({
    ownerId,
    threadId: input.threadId,
    body: input.body,
    targetAgentId: input.targetAgentId,
    payload: input.payload,
  });

  if (!item) {
    return { error: "Failed to enqueue message (queue table may be missing)" };
  }

  await tryDispatchThreadQueue({
    ownerId,
    clerkUserId,
    threadId: input.threadId,
  });

  const [openQueue, budget] = await Promise.all([
    listOpenQueuedMessages({ ownerId, threadId: input.threadId }),
    getPlanBudgetForUser({ clerkUserId, ownerId }),
  ]);

  return { item, openQueue, budget };
}

/**
 * Drain the next eligible queued message for a thread when the agent is idle
 * and the user's plan budget allows. Safe to call from stream onFinish and API routes.
 */
export async function tryDispatchThreadQueue(args: {
  ownerId: string;
  clerkUserId: string;
  threadId: string;
}): Promise<{ dispatched: boolean; holdReason?: string }> {
  const { ownerId, clerkUserId, threadId } = args;
  const lockKey = `${ownerId}:${threadId}`;

  if (dispatchingThreads.has(lockKey)) {
    return { dispatched: false, holdReason: "Dispatch already in progress" };
  }

  dispatchingThreads.add(lockKey);

  let shouldContinue = false;
  /** Set once a worker's subagent lease is released, so a blocked sibling can take its slot. */
  let releasedSubagentParent: string | undefined;
  let result: { dispatched: boolean; holdReason?: string } = { dispatched: false };

  try {
    const activeStreamId = await getThreadActiveStreamId(threadId);
    const budget = await getPlanBudgetForUser({ clerkUserId, ownerId });
    const gate = evaluateDispatchGates({
      activeStreamId,
      canDispatchBudget: budget.canDispatch,
      budgetHoldReason: budget.holdReason,
    });

    if (!gate.ok) {
      const open = await listOpenQueuedMessages({ ownerId, threadId, limit: 1 });
      const head = open[0];

      if (head && (head.status === "pending" || head.status.startsWith("blocked_"))) {
        await updateQueuedMessageStatus({
          id: head.id,
          status: gate.status,
          holdReason: gate.holdReason,
        });
      }

      result = { dispatched: false, holdReason: gate.holdReason };
    } else {
      const claimed = await claimNextQueuedMessage({ ownerId, threadId });

      if (claimed) {
        const streamAfterClaim = await getThreadActiveStreamId(threadId);
        const budgetAfterClaim = await getPlanBudgetForUser({ clerkUserId, ownerId });
        const gateAfter = evaluateDispatchGates({
          activeStreamId: streamAfterClaim,
          canDispatchBudget: budgetAfterClaim.canDispatch,
          budgetHoldReason: budgetAfterClaim.holdReason,
        });

        if (!gateAfter.ok) {
          await releaseClaimedMessage({
            id: claimed.id,
            status: gateAfter.status,
            holdReason: gateAfter.holdReason,
          });
          result = { dispatched: false, holdReason: gateAfter.holdReason };
        } else {
          logger.log(
            "tryDispatchThreadQueue",
            `Dispatching queue item ${claimed.id} on thread ${threadId}`
          );

          // Workers count against their orchestrator's subagent allotment, not the chat slots.
          const parentThreadId = claimed.payload?.subagentRun?.orchestratorId;
          let admission: StreamAdmission;

          try {
            admission = parentThreadId
              ? await acquireSubagentStreamLease(ownerId, parentThreadId, threadId)
              : await acquireChatStreamLease(ownerId, threadId);
          } catch {
            await releaseClaimedMessage({
              id: claimed.id,
              status: "pending",
              holdReason: "Stream admission unavailable",
            });

            return { dispatched: false, holdReason: "Stream admission unavailable" };
          }
          if (!admission.ok && admission.reason === "not_found") {
            // The thread is gone or not this owner's: retrying can never succeed.
            const error = "Thread not found";

            await releaseClaimedMessage({
              id: claimed.id,
              status: "failed",
              error,
              holdReason: error,
            });

            return { dispatched: false, holdReason: error };
          }
          if (!admission.ok) {
            await releaseClaimedMessage({
              id: claimed.id,
              status: "blocked_streaming",
              holdReason: admission.reason,
            });

            return { dispatched: false, holdReason: admission.reason };
          }
          try {
            const reservation = { ownerId, threadId, streamId: `queue:${claimed.id}` };

            if (!(await reserveThreadStream(reservation))) {
              await releaseClaimedMessage({
                id: claimed.id,
                status: "blocked_streaming",
                holdReason: "Thread is busy",
              });

              return { dispatched: false, holdReason: "Thread is busy" };
            }
            let turnResult: Awaited<ReturnType<typeof runQueuedChatTurn>>;

            try {
              turnResult = await runQueuedChatTurn({
                item: claimed,
                sbUserId: ownerId,
                clerkUserId,
              });
            } catch (error) {
              turnResult = {
                ok: false,
                error: error instanceof Error ? error.message : "Background turn failed",
              };
            } finally {
              await releaseThreadStream(reservation);
            }

            if (!turnResult.ok) {
              await releaseClaimedMessage({
                id: claimed.id,
                status: "failed",
                error: turnResult.error,
                holdReason: turnResult.error,
              });
              result = { dispatched: false, holdReason: turnResult.error };
            } else {
              await updateQueuedMessageStatus({
                id: claimed.id,
                status: "sent",
              });
              shouldContinue = true;
              result = { dispatched: true };
            }
          } finally {
            await admission.release();
            releasedSubagentParent = parentThreadId;
          }
        }
      }
    }
  } finally {
    dispatchingThreads.delete(lockKey);
  }

  if (shouldContinue) {
    result = await tryDispatchThreadQueue({ ownerId, clerkUserId, threadId });
  }
  if (releasedSubagentParent) {
    await startBlockedSibling({
      ownerId,
      clerkUserId,
      parentThreadId: releasedSubagentParent,
      finishedThreadId: threadId,
    });
  }

  return result;
}

/**
 * A worker's slot just freed: start the oldest sibling held for capacity. Only one — when it
 * finishes, its own release starts the next, so the chain never exceeds the allotment. The Arcadia
 * heartbeat also re-dispatches every child thread, which recovers a chain cut short by a
 * terminated invocation.
 */
async function startBlockedSibling(args: {
  ownerId: string;
  clerkUserId: string;
  parentThreadId: string;
  finishedThreadId: string;
}): Promise<void> {
  try {
    const siblings = await listBlockedSubagentThreadIds({
      ownerId: args.ownerId,
      parentThreadId: args.parentThreadId,
    });
    const next = siblings.find((id) => id !== args.finishedThreadId);

    if (next) {
      await tryDispatchThreadQueue({
        ownerId: args.ownerId,
        clerkUserId: args.clerkUserId,
        threadId: next,
      });
    }
  } catch (err) {
    logger.warn("startBlockedSibling", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Best-effort dispatch kick after a live chat stream finishes.
 * Looks up Clerk id via the caller (onFinish has sbUserId only) — pass clerkUserId when known.
 */
export async function kickDispatchAfterStream(args: {
  ownerId: string;
  clerkUserId: string;
  threadId: string;
}): Promise<void> {
  try {
    await tryDispatchThreadQueue(args);
  } catch (err) {
    logger.warn("kickDispatchAfterStream", err instanceof Error ? err.message : String(err));
  }
}
