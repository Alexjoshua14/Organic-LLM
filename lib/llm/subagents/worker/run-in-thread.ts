import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { LanguageModelUsage, ModelMessage, UIMessage } from "ai";
import type { WorkerAwarenessEvent, WorkerGoal } from "@/lib/schemas/subagent-runtime";
import type { SubagentThreadStatus } from "@/lib/llm/subagents/threads/status";
import type { RunWorkerGoalResult } from "@/lib/llm/subagents/worker/run";

import { randomUUID } from "crypto";

import { convertToModelMessages, generateText } from "ai";

import {
  defaultOrchestratorAwarenessBus,
  type OrchestratorAwarenessBus,
} from "@/lib/llm/subagents/orchestrator/awareness";
import { foldSystemNoticesForModel } from "@/lib/llm/subagents/threads/fold-system-notices";
import {
  buildSubagentGoalMessage,
  buildSubagentReplyMessage,
} from "@/lib/llm/subagents/threads/messages";
import {
  buildWorkerSystem,
  milestoneFromOutcome,
  shortError,
  summarizeOutcome,
} from "@/lib/llm/subagents/worker/run-with-model";
import { gatewayAttribution } from "@/lib/usage/gateway-attribution";

/** Messages of the subagent's own thread handed to the model each run. */
export const SUBAGENT_THREAD_CONTEXT_MESSAGES = 30;

/** Persistence for one subagent thread. Implementations must scope every call to the owner. */
export type SubagentThreadStore = {
  loadMessages(threadId: string, limit: number): Promise<UIMessage[]>;
  appendMessages(threadId: string, messages: UIMessage[]): Promise<boolean>;
  setStatus(threadId: string, status: SubagentThreadStatus): Promise<void>;
};

export type SubagentTurnGenerate = (args: {
  model: string;
  system: string;
  messages: ModelMessage[];
  providerOptions: {
    gateway: Pick<GatewayProviderOptions, "zeroDataRetention" | "user" | "tags">;
  };
}) => Promise<{ text: string; usage?: LanguageModelUsage; providerMetadata?: unknown }>;

export type SubagentUsageRecorder = (args: {
  modelId: string;
  usage?: LanguageModelUsage;
  providerMetadata?: unknown;
}) => void | Promise<void>;

export type RunSubagentThreadTurnInput = {
  goal: WorkerGoal;
  threadId: string;
  modelId: string;
  ownerId: string;
  /** The user's ZDR setting for this turn — worker calls honour it like the orchestrator's. */
  zeroDataRetention: boolean;
  workerName?: string;
  workerRole?: string;
  store: SubagentThreadStore;
  generate?: SubagentTurnGenerate;
  recordUsage?: SubagentUsageRecorder;
  bus?: OrchestratorAwarenessBus;
  now?: () => number;
};

export function buildSubagentThreadSystem(name?: string, role?: string): string {
  return [
    buildWorkerSystem(name, role),
    "This thread is yours alone: it holds your assignments and replies. You cannot see the",
    "orchestrator's thread or other subagents' threads. Messages marked “From the orchestrator”",
    "are assignments; other user messages are the user talking to you directly.",
  ].join(" ");
}

const defaultGenerate: SubagentTurnGenerate = async (args) => {
  const { system, ...options } = args;
  const result = await generateText({ ...options, instructions: system });

  return { text: result.text, usage: result.usage, providerMetadata: result.providerMetadata };
};

/**
 * One async worker run inside the subagent's own thread: read only that thread, reply into it,
 * and keep `subagent_status` honest. Never throws — failures land as `blocked` plus a short note.
 */
export async function runSubagentThreadTurn(
  input: RunSubagentThreadTurnInput
): Promise<RunWorkerGoalResult> {
  const bus = input.bus ?? defaultOrchestratorAwarenessBus;
  const now = input.now ?? Date.now;
  const generate = input.generate ?? defaultGenerate;
  const { goal, threadId, store } = input;
  const events: WorkerAwarenessEvent[] = [];

  const publish = (event: WorkerAwarenessEvent) => {
    events.push(event);
    bus.publish(goal.orchestratorId, event);
  };

  await store.setStatus(threadId, "working").catch(() => undefined);
  publish({
    kind: "progress",
    goalId: goal.goalId,
    agentId: goal.agentId,
    narrative: "Accepted goal — calling model.",
    progressPct: 0,
    at: now(),
    assignedGoal: goal.goal,
  });

  try {
    let history = await store.loadMessages(threadId, SUBAGENT_THREAD_CONTEXT_MESSAGES);

    // The goal row is written before scheduling; if that save failed, still give the model it.
    if (history.length === 0) {
      history = [buildSubagentGoalMessage({ goal: goal.goal, goalId: goal.goalId })];
    }

    const result = await generate({
      model: input.modelId,
      system: buildSubagentThreadSystem(input.workerName, input.workerRole),
      messages: await convertToModelMessages(foldSystemNoticesForModel([
        ...history,
        buildSubagentGoalMessage({ goal: `For this run, respond to this assignment: ${goal.goal}`, goalId: goal.goalId }),
      ])),
      providerOptions: {
        gateway: {
          zeroDataRetention: input.zeroDataRetention,
          ...gatewayAttribution({ userId: input.ownerId, operation: "subagent_worker" }),
        },
      },
    });

    await input.recordUsage?.({
      modelId: input.modelId,
      usage: result.usage,
      providerMetadata: result.providerMetadata,
    });

    const text = result.text.trim() || "I finished without anything to report.";

    const saved = await store.appendMessages(threadId, [
      buildSubagentReplyMessage({ text, goalId: goal.goalId, modelId: input.modelId }),
    ]);
    if (!saved) throw new Error("Could not save subagent result");
    await store.setStatus(threadId, "done");

    const summary = summarizeOutcome(text);

    publish({
      kind: "milestone",
      goalId: goal.goalId,
      agentId: goal.agentId,
      milestone: { id: randomUUID(), label: milestoneFromOutcome(summary), at: now() },
      at: now(),
    });
    publish({ kind: "completion", goalId: goal.goalId, agentId: goal.agentId, summary, at: now() });

    return { runtimeRole: "worker", goalId: goal.goalId, events, completed: true };
  } catch (err) {
    const error = shortError(err);

    await store
      .appendMessages(threadId, [
        buildSubagentReplyMessage({
          text: `I couldn't finish this: ${error}`,
          goalId: goal.goalId,
          modelId: input.modelId,
          failed: true,
        }),
      ])
      .catch(() => false);
    await store.setStatus(threadId, "blocked").catch(() => undefined);
    publish({ kind: "failure", goalId: goal.goalId, agentId: goal.agentId, error, at: now() });

    return { runtimeRole: "worker", goalId: goal.goalId, events, completed: false };
  }
}
