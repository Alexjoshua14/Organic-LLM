import "server-only";

import type { MultitaskTurnDeps } from "@/lib/llm/subagents/orchestrator/prepare-multitask-turn";

import { after } from "next/server";

import {
  appendThreadMessagesWithAdmin,
  ensureSubagentThread,
  getSubagentThreadLink,
  isThreadArcadiaMultitaskEnabled,
  listSubagentThreadRows,
  readThreadMessagesWithAdmin,
  setSubagentThreadStatus,
} from "@/data/supabase/subagent-threads";
import { insertQueuedMessage } from "@/data/supabase/message-send-queue";
import { getHardSetShellAgentId } from "@/data/supabase/subagent-shells";
import { createSupabaseWorktableStore } from "@/data/supabase/subagent-worktable";
import { recordGatewayCallUsage } from "@/lib/usage/record-gateway-call";


/**
 * Real persistence for {@link prepareArcadiaMultitaskTurn}: Supabase (admin, owner-scoped),
 * usage events, and Next `after` so subagent runs outlive the orchestrator's stream.
 */
export function createMultitaskTurnDeps(args: { ownerId: string; clerkUserId: string; route: string }): MultitaskTurnDeps {
  const { ownerId, route } = args;

  return {
    getLink: (threadId) => getSubagentThreadLink(threadId, ownerId),
    getHardSetShellAgentId: (threadId) => getHardSetShellAgentId(threadId, ownerId),
    isMultitaskEnabled: (threadId) => isThreadArcadiaMultitaskEnabled(threadId, ownerId),
    listChildren: (parentThreadId) => listSubagentThreadRows(parentThreadId, ownerId),
    ensureChild: ({ parentThreadId, agentId, title }) =>
      ensureSubagentThread({ ownerId, parentThreadId, agentId, title }),
    loadMessages: (threadId, limit) => readThreadMessagesWithAdmin({ threadId, ownerId, limit }),
    appendMessages: (threadId, messages) =>
      appendThreadMessagesWithAdmin({ threadId, ownerId, messages }),
    setStatus: (threadId, status) => setSubagentThreadStatus({ threadId, ownerId, status }),
    openWorktable: (threadId) => createSupabaseWorktableStore({ threadId, ownerId }),
    recordUsage: ({ modelId, usage, providerMetadata, operation }) =>
      recordGatewayCallUsage({ ownerId, modelId, usage, providerMetadata, operation, route }),
    enqueueWorker: async ({ goal, threadId, modelId, zeroDataRetention }) => {
      const { goal: _text, ...reference } = goal;
      const queued = await insertQueuedMessage({
        id: goal.goalId,
        ownerId,
        threadId,
        body: "Subagent assignment",
        payload: { experience: "arcadia", zeroDataRetention, subagentRun: { ...reference, modelId } },
      });
      if (!queued) throw new Error("Could not queue subagent assignment");
      after(async () => {
        const { tryDispatchThreadQueue } = await import("@/lib/message-queue/dispatch");
        await tryDispatchThreadQueue({ ownerId, clerkUserId: args.clerkUserId, threadId });
      });
    },
  };
}
