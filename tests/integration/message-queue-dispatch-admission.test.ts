import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import * as queueData from "@/data/supabase/message-send-queue";
import * as streamAdmission from "@/lib/chat/stream-admission";
import * as planBudget from "@/lib/plans/plan-budget";
import * as queuedTurn from "@/lib/message-queue/run-queued-chat-turn";
import { mockModulePreservingReal } from "../helpers/module-mock";

import { tryDispatchThreadQueue } from "@/lib/message-queue/dispatch";

type Item = {
  id: string;
  thread_id: string;
  status: string;
  payload?: { subagentRun?: { orchestratorId: string } };
};
const ITEM: Item = { id: "item-1", thread_id: "thread-1", status: "dispatching" };
const WORKER: Item = {
  id: "worker-1",
  thread_id: "thread-1",
  status: "dispatching",
  payload: { subagentRun: { orchestratorId: "orchestrator-1" } },
};
const args = { ownerId: "owner-1", clerkUserId: "clerk-1", threadId: "thread-1" };

type Admission = Awaited<ReturnType<typeof streamAdmission.acquireChatStreamLease>>;

const release = mock(async () => {});
const acquire = mock(async (): Promise<Admission> => ({ ok: true, release }));
const acquireSubagent = mock(async (): Promise<Admission> => ({ ok: true, release }));
const blockedSiblings = mock(async (): Promise<string[]> => []);
const runTurn = mock(async () => ({ ok: true }) as { ok: boolean; error?: string });
const releaseClaimed = mock(async (_input: Record<string, unknown>) => true);
const updateStatus = mock(async (_input: Record<string, unknown>) => true);
const reserve = mock(async () => true);
const releaseReservation = mock(async () => {});
/** Per-thread queues; `claimNextQueuedMessage` pops from the requested thread. */
let queued: Record<string, Item[]> = {};

const restores: Array<() => void> = [];

beforeAll(() => {
  restores.push(
    mockModulePreservingReal("@/lib/chat/stream-admission", streamAdmission, {
      acquireChatStreamLease: acquire as unknown as typeof streamAdmission.acquireChatStreamLease,
      acquireSubagentStreamLease:
        acquireSubagent as unknown as typeof streamAdmission.acquireSubagentStreamLease,
    }),
    mockModulePreservingReal("@/lib/plans/plan-budget", planBudget, {
      getPlanBudgetForUser: (async () => ({
        canDispatch: true,
      })) as unknown as typeof planBudget.getPlanBudgetForUser,
    }),
    mockModulePreservingReal("@/lib/message-queue/run-queued-chat-turn", queuedTurn, {
      runQueuedChatTurn: runTurn as unknown as typeof queuedTurn.runQueuedChatTurn,
    }),
    mockModulePreservingReal("@/data/supabase/message-send-queue", queueData, {
      getThreadActiveStreamId: (async () => null) as typeof queueData.getThreadActiveStreamId,
      claimNextQueuedMessage: (async ({ threadId }: { threadId: string }) =>
        queued[threadId]?.shift() ?? null) as unknown as typeof queueData.claimNextQueuedMessage,
      listBlockedSubagentThreadIds:
        blockedSiblings as unknown as typeof queueData.listBlockedSubagentThreadIds,
      listOpenQueuedMessages:
        (async () => []) as unknown as typeof queueData.listOpenQueuedMessages,
      releaseClaimedMessage: releaseClaimed as unknown as typeof queueData.releaseClaimedMessage,
      updateQueuedMessageStatus:
        updateStatus as unknown as typeof queueData.updateQueuedMessageStatus,
      reserveThreadStream: reserve as unknown as typeof queueData.reserveThreadStream,
      releaseThreadStream: releaseReservation as unknown as typeof queueData.releaseThreadStream,
    })
  );
});
afterAll(() => {
  for (const restore of restores) restore();
});
beforeEach(() => {
  queued = { "thread-1": [{ ...ITEM }] };
  for (const fn of [
    release,
    acquire,
    acquireSubagent,
    blockedSiblings,
    runTurn,
    releaseClaimed,
    updateStatus,
    reserve,
    releaseReservation,
  ]) {
    fn.mockClear();
  }
  acquire.mockImplementation(async () => ({ ok: true, release }));
  acquireSubagent.mockImplementation(async () => ({ ok: true, release }));
  blockedSiblings.mockImplementation(async () => []);
  runTurn.mockImplementation(async () => ({ ok: true }));
  reserve.mockImplementation(async () => true);
});

describe("queue dispatch with stream admission", () => {
  test("an admitted item runs once and releases its lease", async () => {
    // After a sent item, dispatch recurses to drain the next one; the queue is then empty.
    expect(await tryDispatchThreadQueue(args)).toEqual({ dispatched: false });
    expect(acquire).toHaveBeenCalledWith("owner-1", "thread-1");
    expect(runTurn).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(releaseReservation).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith({ id: "item-1", status: "sent" });
  });

  test.each(["capacity", "busy"] as const)(
    "a %s denial holds the item without running it",
    async (reason) => {
      acquire.mockImplementation(async () => ({ ok: false, reason }));

      expect(await tryDispatchThreadQueue(args)).toEqual({ dispatched: false, holdReason: reason });
      expect(releaseClaimed).toHaveBeenCalledWith({
        id: "item-1",
        status: "blocked_streaming",
        holdReason: reason,
      });
      expect(reserve).not.toHaveBeenCalled();
      expect(runTurn).not.toHaveBeenCalled();
    }
  );

  test("a not_found denial fails the item instead of holding it forever", async () => {
    acquire.mockImplementation(async () => ({ ok: false, reason: "not_found" }));

    expect(await tryDispatchThreadQueue(args)).toEqual({
      dispatched: false,
      holdReason: "Thread not found",
    });
    expect(releaseClaimed).toHaveBeenCalledWith({
      id: "item-1",
      status: "failed",
      error: "Thread not found",
      holdReason: "Thread not found",
    });
    expect(runTurn).not.toHaveBeenCalled();
  });

  test("an admission outage returns the item to pending", async () => {
    acquire.mockImplementation(async () => {
      throw new Error("Stream admission unavailable");
    });

    expect(await tryDispatchThreadQueue(args)).toEqual({
      dispatched: false,
      holdReason: "Stream admission unavailable",
    });
    expect(releaseClaimed).toHaveBeenCalledWith({
      id: "item-1",
      status: "pending",
      holdReason: "Stream admission unavailable",
    });
    expect(runTurn).not.toHaveBeenCalled();
  });

  test("a failing turn still releases the lease and the reservation", async () => {
    runTurn.mockImplementation(async () => {
      throw new Error("model exploded");
    });

    expect(await tryDispatchThreadQueue(args)).toEqual({
      dispatched: false,
      holdReason: "model exploded",
    });
    expect(release).toHaveBeenCalledTimes(1);
    expect(releaseReservation).toHaveBeenCalledTimes(1);
    expect(releaseClaimed).toHaveBeenCalledWith(
      expect.objectContaining({ id: "item-1", status: "failed" })
    );
  });

  test("a lost thread reservation releases the lease without running", async () => {
    reserve.mockImplementation(async () => false);

    expect(await tryDispatchThreadQueue(args)).toEqual({
      dispatched: false,
      holdReason: "Thread is busy",
    });
    expect(release).toHaveBeenCalledTimes(1);
    expect(runTurn).not.toHaveBeenCalled();
  });

  test("a chat item never looks for blocked subagent siblings", async () => {
    await tryDispatchThreadQueue(args);
    expect(acquireSubagent).not.toHaveBeenCalled();
    expect(blockedSiblings).not.toHaveBeenCalled();
  });

  test("a worker takes a subagent lease against its orchestrator", async () => {
    queued = { "thread-1": [{ ...WORKER }] };
    await tryDispatchThreadQueue(args);

    expect(acquire).not.toHaveBeenCalled();
    expect(acquireSubagent).toHaveBeenCalledWith("owner-1", "orchestrator-1", "thread-1");
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("a finished worker starts the oldest blocked sibling, once", async () => {
    queued = {
      "thread-1": [{ ...WORKER }],
      "thread-2": [{ ...WORKER, id: "worker-2", thread_id: "thread-2" }],
    };
    blockedSiblings.mockImplementationOnce(async () => ["thread-1", "thread-2", "thread-3"]);

    await tryDispatchThreadQueue(args);

    expect(blockedSiblings).toHaveBeenCalledWith({
      ownerId: "owner-1",
      parentThreadId: "orchestrator-1",
    });
    // The finished thread is skipped; thread-2 runs; thread-3 waits for thread-2's release.
    expect(acquireSubagent.mock.calls.map((call) => (call as unknown[])[2])).toEqual([
      "thread-1",
      "thread-2",
    ]);
    expect(runTurn).toHaveBeenCalledTimes(2);
  });

  test("a worker denied for capacity does not start siblings", async () => {
    queued = { "thread-1": [{ ...WORKER }] };
    acquireSubagent.mockImplementation(async () => ({ ok: false, reason: "capacity" }));

    expect(await tryDispatchThreadQueue(args)).toEqual({
      dispatched: false,
      holdReason: "capacity",
    });
    expect(blockedSiblings).not.toHaveBeenCalled();
  });
});
