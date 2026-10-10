import "server-only";

import type { MessageSendQueueRow } from "@/lib/schemas/message-send-queue";

import {
  appendThreadMessagesWithAdmin,
  getSubagentThreadLink,
  readThreadMessagesWithAdmin,
  setSubagentThreadStatus,
} from "@/data/supabase/subagent-threads";
import { resolveSubagentIdentity } from "@/lib/arcadia/multitask/subagent-identity";
import { stripSubagentGoalPrefix, uiMessageText } from "@/lib/llm/subagents/threads/messages";
import { runSubagentThreadTurn } from "@/lib/llm/subagents/worker/run-in-thread";
import { recordGatewayCallUsage } from "@/lib/usage/record-gateway-call";

/** Queue stores only references; assignment text remains in the encrypted child thread. */
export async function runQueuedSubagentTurn(item: MessageSendQueueRow, ownerId: string) {
  const run = item.payload.subagentRun!;
  const threadId = item.thread_id;
  const link = await getSubagentThreadLink(threadId, ownerId);
  if (!link || link.agentId !== run.agentId || link.parentThreadId !== run.orchestratorId) {
    return { ok: false as const, error: "Subagent thread is no longer attached to this orchestrator" };
  }
  const [assignment] = await readThreadMessagesWithAdmin({
    threadId, ownerId, limit: 1, messageId: run.goalId,
  });
  if (!assignment) return { ok: false as const, error: "Subagent assignment is unavailable" };
  const identity = resolveSubagentIdentity(link.agentId);
  const result = await runSubagentThreadTurn({
    goal: { ...run, goal: stripSubagentGoalPrefix(uiMessageText(assignment)) },
    threadId,
    ownerId,
    modelId: run.modelId,
    zeroDataRetention: item.payload.zeroDataRetention === true,
    workerName: identity.name,
    workerRole: identity.role,
    store: {
      loadMessages: (id, limit) => readThreadMessagesWithAdmin({ threadId: id, ownerId, limit }),
      appendMessages: (id, messages) => appendThreadMessagesWithAdmin({ threadId: id, ownerId, messages }),
      setStatus: (id, status) => setSubagentThreadStatus({ threadId: id, ownerId, status }),
    },
    recordUsage: (usage) => recordGatewayCallUsage({ ...usage, ownerId, operation: "subagent_worker", route: "/api/chat/queue" }),
  });
  return result.completed ? { ok: true as const } : { ok: false as const, error: "Subagent could not complete the assignment" };
}
