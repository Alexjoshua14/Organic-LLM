import "server-only";

import type { EnqueueMessageInput, MessageSendQueueRow } from "@/lib/schemas/message-send-queue";

import {
  claimNextQueuedMessage,
  getThreadActiveStreamId,
  insertQueuedMessage,
  listOpenQueuedMessages,
  releaseClaimedMessage,
  updateQueuedMessageStatus,
} from "@/data/supabase/message-send-queue";
import { createLogger } from "@/lib/logger";
import { evaluateDispatchGates } from "@/lib/message-queue/dispatch-gates";
import { runQueuedChatTurn } from "@/lib/message-queue/run-queued-chat-turn";
import { getPlanBudgetForUser } from "@/lib/plans/monthly-budget";

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

          const turnResult = await runQueuedChatTurn({
            item: claimed,
            sbUserId: ownerId,
            clerkUserId,
          });

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
        }
      }
    }
  } finally {
    dispatchingThreads.delete(lockKey);
  }

  if (shouldContinue) {
    return tryDispatchThreadQueue({ ownerId, clerkUserId, threadId });
  }

  return result;
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
