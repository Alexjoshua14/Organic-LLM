import type { GatewayModelId, GatewayProviderOptions } from "@ai-sdk/gateway";
import type { LanguageModelUsage, ModelMessage, UIMessage } from "ai";
import type { WorkerAwarenessEvent, WorkerGoal } from "@/lib/schemas/subagent-runtime";
import type { SubagentThreadStatus } from "@/lib/llm/subagents/threads/status";
import type { RunWorkerGoalResult } from "@/lib/llm/subagents/worker/run";
import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";

import { randomUUID } from "crypto";

import { convertToModelMessages, generateText, isStepCount } from "ai";

import {
  defaultOrchestratorAwarenessBus,
  type OrchestratorAwarenessBus,
} from "@/lib/llm/subagents/orchestrator/awareness";
import { buildLockedWorkerSystem } from "@/lib/llm/subagents/hard-set/shell";
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
import { AGENT_MODEL } from "../../helpers";
import { compileChatTools } from "../../compile-chat-tools";

/** Messages of the subagent's own thread handed to the model each run. */
export const SUBAGENT_THREAD_CONTEXT_MESSAGES = 30;

const SUBAGENT_MAX_OUTPUT_CAP = {
  tier0_model: 500_000, // Most expensive models, Fable/Astra level
  tier1_model: 1_000_000, // Second most expensive, Opus/Sol/ level
  tier2_model: 2_000_000, // More affordable models, Sonnet level
  tier3_mode: 10_000_000, // Cheap models, Luna, GPT OSS, level
};

/** Persistence for one subagent thread. Implementations must scope every call to the owner. */
export type SubagentThreadStore = {
  loadMessages(threadId: string, limit: number): Promise<UIMessage[]>;
  appendMessages(threadId: string, messages: UIMessage[]): Promise<boolean>;
  setStatus(threadId: string, status: SubagentThreadStatus): Promise<void>;
};

export type SubagentTurnGenerate = (args: {
  chatId: string;
  /** A locked subagent's tool policy; omitted flags use the worker defaults. */
  tools?: HardSetSubagent["tools"];
  initialMessageCount: number;
  sbUserId: string;
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
  /** A hard-set subagent locked into the roster: runs on its own instructions and tool policy. */
  lockedPersona?: HardSetSubagent;
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
  const { system, chatId, initialMessageCount, sbUserId, tools: toolPolicy, ...options } = args;
  const agent_defaults = AGENT_MODEL()
  const output_cap = agent_defaults.maxOutputTokens;
  const max_steps = agent_defaults.maxStepCount;

  const { tools, toolInstructions } = await compileChatTools({
    useSearch: toolPolicy?.webSearch ?? true,
    useMemory: toolPolicy?.memory ?? false,
    useGetMoreMessages: toolPolicy?.chatHistory ?? true,
    useKnowledgeSearch: false,
    experience: "arcadia",
    chatId,
    initialMessageCount,
    sbUserId,
  });

  const hasTools = Object.keys(tools).length > 0;

  const result = await generateText({
    ...options,
    instructions: [system, toolInstructions].filter(Boolean).join("\n\n"),
    maxOutputTokens: output_cap,
    tools,
    toolChoice: hasTools ? "auto" : "none",
    stopWhen: isStepCount(max_steps),
  });

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
      chatId: threadId,
      initialMessageCount: history.length,
      sbUserId: input.ownerId,
      model: input.modelId,
      system: input.lockedPersona
        ? buildLockedWorkerSystem(input.lockedPersona)
        : buildSubagentThreadSystem(input.workerName, input.workerRole),
      ...(input.lockedPersona ? { tools: input.lockedPersona.tools } : {}),
      messages: await convertToModelMessages(
        foldSystemNoticesForModel([
          ...history,
          buildSubagentGoalMessage({
            goal: `For this run, respond to this assignment: ${goal.goal}`,
            goalId: goal.goalId,
          }),
        ])
      ),
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
