import type { LanguageModelUsage, UIMessage, UIMessageStreamWriter } from "ai";
import type { ChatUIMessage } from "@/types/ai";
import type { ArcadiaMultitaskSendTargetParsed } from "@/lib/schemas/arcadia-multitask-send-target";
import type { WorkerGoal } from "@/lib/schemas/subagent-runtime";
import type { SubagentThreadRow, SubagentThreadSnapshot } from "@/lib/llm/subagents/threads/snapshot";
import type { SubagentThreadStatus } from "@/lib/llm/subagents/threads/status";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import {
  pickRosterSlotForRole,
  resolveSubagentIdentity,
} from "@/lib/arcadia/multitask/subagent-identity";
import { dispatchMultitaskInbound } from "@/lib/llm/subagents/orchestrator/dispatch-inbound";
import { formatMultitaskRoutingSystemFragment } from "@/lib/llm/subagents/orchestrator/format-routing-fragment";
import {
  createJevThoughtRouter,
  type ThoughtRouter,
  type ThoughtRouterWorker,
} from "@/lib/llm/subagents/orchestrator/thought-router";
import { buildSubagentGoalMessage } from "@/lib/llm/subagents/threads/messages";
import {
  buildSubagentThreadSnapshot,
  clampExcerpt,
  formatSubagentStatusFragment,
  SUBAGENT_SNAPSHOT_MESSAGE_WINDOW,
} from "@/lib/llm/subagents/threads/snapshot";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/llm/subagents/orchestrator/prepare-multitask-turn.ts");

export type SubagentThreadLinkLite = {
  threadId: string;
  parentThreadId: string;
  agentId: string;
};

/** Persistence + scheduling seams. {@link createMultitaskTurnDeps} wires the real ones. */
export type MultitaskTurnDeps = {
  getLink(threadId: string): Promise<SubagentThreadLinkLite | null>;
  listChildren(parentThreadId: string): Promise<SubagentThreadRow[]>;
  ensureChild(args: { parentThreadId: string; agentId: string; title: string }): Promise<
    string | null
  >;
  loadMessages(threadId: string, limit: number): Promise<UIMessage[]>;
  appendMessages(threadId: string, messages: UIMessage[]): Promise<boolean>;
  setStatus(threadId: string, status: SubagentThreadStatus): Promise<void>;
  recordUsage(args: {
    modelId: string;
    usage?: LanguageModelUsage;
    providerMetadata?: unknown;
    operation: "multitask_router" | "subagent_worker";
  }): void | Promise<void>;
  /** Persist an assignment for background dispatch, without awaiting the worker. */
  enqueueWorker(args: { goal: WorkerGoal; threadId: string; modelId: string; zeroDataRetention: boolean }): Promise<void>;
  router?: ThoughtRouter;
};

export type MultitaskStreamWriter = Pick<UIMessageStreamWriter<ChatUIMessage>, "write">;

export type PrepareMultitaskTurnInput = {
  chatId: string;
  ownerId: string;
  userText: string;
  sendTarget?: ArcadiaMultitaskSendTargetParsed | null;
  modelId: string;
  zeroDataRetention: boolean;
  writer?: MultitaskStreamWriter;
  deps: MultitaskTurnDeps;
  now?: () => number;
};

export type PrepareMultitaskTurnResult = {
  role: "orchestrator" | "subagent";
  /** Appended to the turn's system prompt, in order. */
  systemFragments: string[];
  /** True when this orchestrator has at least one subagent thread (gates the reader tool). */
  hasSubagentThreads: boolean;
};

export function formatSubagentDirectChatFragment(agentId: string): string {
  const identity = resolveSubagentIdentity(agentId);

  return [
    "[Subagent thread]",
    `You are ${identity.name}, the ${identity.role} subagent in Organic LLM's Arcadia multitask shell.`,
    "The user is talking to you directly in your own thread. You can see only this thread — not",
    "the orchestrator's thread and not other subagents' threads. Messages marked “From the",
    "orchestrator” are your assignments. Stay in your role and keep replies focused on your work.",
  ].join("\n");
}

function rosterForRouter(snapshots: ReadonlyArray<SubagentThreadSnapshot>): ThoughtRouterWorker[] {
  const byAgent = new Map(snapshots.map((s) => [s.agentId, s]));
  const slots = createDemoSubagents().map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    goal: byAgent.get(a.id)?.lastGoal ?? a.goal,
  }));
  const slotIds = new Set(slots.map((s) => s.id));
  const extras = snapshots
    .filter((s) => !slotIds.has(s.agentId))
    .map((s) => ({ id: s.agentId, name: s.name, role: s.role, goal: s.lastGoal ?? "" }));

  return [...slots, ...extras];
}

function groupGoalsByAgent(goals: ReadonlyArray<WorkerGoal>): Map<string, WorkerGoal[]> {
  const byAgent = new Map<string, WorkerGoal[]>();

  for (const goal of goals) {
    byAgent.set(goal.agentId, [...(byAgent.get(goal.agentId) ?? []), goal]);
  }

  return byAgent;
}

/**
 * Arcadia multitask turn preparation, shared by `/api/chat` and the send queue.
 *
 * - On a subagent thread: no dispatch; the turn runs as that subagent over its own thread.
 * - On an orchestrator thread: route the message, write each assignment into the subagent's own
 *   thread, schedule the run after the response, and give the orchestrator a status summary of
 *   every subagent thread. Never throws — multitask trouble must not fail the orchestrator reply.
 */
export async function prepareArcadiaMultitaskTurn(
  input: PrepareMultitaskTurnInput
): Promise<PrepareMultitaskTurnResult> {
  const { chatId, ownerId, deps } = input;
  const now = input.now ?? Date.now;

  try {
    const link = await deps.getLink(chatId);

    if (link) {
      return {
        role: "subagent",
        systemFragments: [formatSubagentDirectChatFragment(link.agentId)],
        hasSubagentThreads: false,
      };
    }

    const children = await deps.listChildren(chatId);
    const snapshots = await Promise.all(
      children.map(async (row) =>
        buildSubagentThreadSnapshot(
          row,
          await deps.loadMessages(row.threadId, SUBAGENT_SNAPSHOT_MESSAGE_WINDOW),
          now()
        )
      )
    );
    const childByAgent = new Map(children.map((row) => [row.agentId, row]));
    const systemFragments: string[] = [];

    if (input.userText.trim().length > 0) {
      const roster = rosterForRouter(snapshots);
      const busy = new Set(snapshots.filter((s) => s.status === "working").map((s) => s.agentId));
      const router =
        deps.router ??
        createJevThoughtRouter({
          ownerId,
          onUsage: (usage) => deps.recordUsage({ ...usage, operation: "multitask_router" }),
        });

      const inbound = await dispatchMultitaskInbound({
        text: input.userText,
        sendTarget: input.sendTarget,
        workers: roster,
        orchestratorId: chatId,
        router,
        now,
        resolveNewSubagentId: (role) => {
          const slot = pickRosterSlotForRole(role, { busyAgentIds: busy });

          if (slot) busy.add(slot);

          return slot;
        },
      });

      const threadIdByAgent = new Map<string, string>();
      const fallbackGoals: WorkerGoal[] = [];

      for (const [agentId, goals] of groupGoalsByAgent(inbound.assignedGoals)) {
        const identity = resolveSubagentIdentity(agentId);
        const threadId =
          childByAgent.get(agentId)?.threadId ??
          (await deps.ensureChild({
            parentThreadId: chatId,
            agentId,
            title: `${identity.name} · ${identity.role}`,
          }));

        if (!threadId) {
          fallbackGoals.push(...goals);
          continue;
        }

        // Write the assignment before scheduling: the thread is never empty (blank-chat
        // auto-delete) and the board shows `working` the moment the stream ends.
        const saved = await deps.appendMessages(
          threadId,
          goals.map((g) => buildSubagentGoalMessage({ goal: g.goal, goalId: g.goalId, id: g.goalId }))
        );
        if (!saved) throw new Error("Could not persist subagent assignment");
        await deps.setStatus(threadId, "working");
        threadIdByAgent.set(agentId, threadId);

        upsertWorkingSnapshot(snapshots, { agentId, threadId, goal: goals.at(-1)!.goal, now });

        for (const goal of goals) {
          await deps.enqueueWorker({ goal, threadId, modelId: input.modelId, zeroDataRetention: input.zeroDataRetention });
        }
      }

      if (fallbackGoals.length > 0) {
        // Missing schema must never restore the old blocking behavior or invent a delegation.
        const unavailable = new Set(fallbackGoals.map((goal) => goal.goalId));
        inbound.assignedGoals = inbound.assignedGoals.filter((goal) => !unavailable.has(goal.goalId));
        inbound.directThoughts.push(...fallbackGoals.map((goal) => goal.goal));
        systemFragments.push("Subagent storage is unavailable. No background worker was started for the unassigned work; answer it here and explain that delegation is unavailable.");
      }

      input.writer?.write({
        type: "data-multitask-routing",
        data: {
          sendTarget: inbound.sendTarget,
          mode: inbound.mode,
          routing: inbound.routing,
          deliveredAgentId: inbound.deliveredAgentId,
          deliveredText: inbound.deliveredText,
          assignedGoals: inbound.assignedGoals.map((g) => ({
            goalId: g.goalId,
            agentId: g.agentId,
            goal: g.goal,
            ...(threadIdByAgent.has(g.agentId) ? { threadId: threadIdByAgent.get(g.agentId) } : {}),
          })),
          directThoughts: inbound.directThoughts,
        },
        transient: true,
      });
      systemFragments.push(formatMultitaskRoutingSystemFragment(inbound));
    }

    const statusFragment = formatSubagentStatusFragment(snapshots);

    if (statusFragment) systemFragments.push(statusFragment);

    return {
      role: "orchestrator",
      systemFragments,
      hasSubagentThreads: snapshots.length > 0,
    };
  } catch (err) {
    logger.error(
      "prepareArcadiaMultitaskTurn",
      `multitask preparation failed: ${err instanceof Error ? err.message : String(err)}`
    );

    return {
      role: "orchestrator",
      systemFragments: [],
      hasSubagentThreads: false,
    };
  }
}

function upsertWorkingSnapshot(
  snapshots: SubagentThreadSnapshot[],
  args: { agentId: string; threadId: string; goal: string; now: () => number }
): void {
  const at = new Date(args.now()).toISOString();
  const existing = snapshots.find((s) => s.agentId === args.agentId);

  if (existing) {
    existing.status = "working";
    existing.statusAt = at;
    existing.lastGoal = clampExcerpt(args.goal);

    return;
  }

  const identity = resolveSubagentIdentity(args.agentId);

  snapshots.push({
    agentId: args.agentId,
    threadId: args.threadId,
    name: identity.name,
    role: identity.role,
    status: "working",
    statusAt: at,
    lastMessageId: null,
    lastGoal: clampExcerpt(args.goal),
    lastOutcome: null,
  });
}
