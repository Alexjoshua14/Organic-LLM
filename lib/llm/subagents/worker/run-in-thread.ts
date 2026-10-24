import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import type { LanguageModelUsage, ModelMessage, UIMessage } from "ai";
import type { WorkerAwarenessEvent, WorkerGoal } from "@/lib/schemas/subagent-runtime";
import type { SubagentThreadStatus } from "@/lib/llm/subagents/threads/status";
import type { RunWorkerGoalResult } from "@/lib/llm/subagents/worker/run";
import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";
import type { ContextBudgetUsage } from "@/lib/chat/context-budget";

import { randomUUID } from "crypto";

import { generateText, isStepCount } from "ai";

import { subagentRunLimits, withSubagentCostLimits } from "./cost-limits";
import { researchToolParts } from "./research-tool-parts";
import {
  buildSubagentThreadSystem,
  prepareWorkerTools,
  SUBAGENT_THREAD_CONTEXT_MESSAGES,
  trimModelMessagesToPreflight,
  workerModelMessages,
} from "./prepare-input";

import {
  defaultOrchestratorAwarenessBus,
  type OrchestratorAwarenessBus,
} from "@/lib/llm/subagents/orchestrator/awareness";
import { buildLockedWorkerSystem } from "@/lib/llm/subagents/hard-set/shell";
import { readSubagentContext } from "@/lib/llm/subagents/threads/context-items";
import { summarizeContextBudgetUsage } from "@/lib/chat/context-budget-usage";
import {
  buildSubagentGoalMessage,
  buildSubagentReplyMessage,
} from "@/lib/llm/subagents/threads/messages";
import {
  milestoneFromOutcome,
  shortError,
  summarizeOutcome,
} from "@/lib/llm/subagents/worker/run-with-model";
import { gatewayAttribution } from "@/lib/usage/gateway-attribution";
import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";

/** Messages of the subagent's own thread handed to the model each run. */
export { SUBAGENT_THREAD_CONTEXT_MESSAGES, buildSubagentThreadSystem } from "./prepare-input";

/** Persistence for one subagent thread. Implementations must scope every call to the owner. */
export type SubagentThreadStore = {
  loadMessages(threadId: string, limit: number): Promise<UIMessage[]>;
  loadMessage?(threadId: string, messageId: string): Promise<UIMessage | null>;
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
  assignment?: UIMessage;
  providerOptions: {
    gateway: Pick<GatewayProviderOptions, "zeroDataRetention" | "user" | "tags">;
  };
}) => Promise<{
  text: string;
  toolParts?: UIMessage["parts"];
  usage?: LanguageModelUsage;
  providerMetadata?: unknown;
  contextUsage?: ContextBudgetUsage;
}>;

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
  /** Exact owned assignment loaded by the queue, independent of the history window. */
  assignment?: UIMessage;
  generate?: SubagentTurnGenerate;
  recordUsage?: SubagentUsageRecorder;
  bus?: OrchestratorAwarenessBus;
  now?: () => number;
};

const defaultGenerate: SubagentTurnGenerate = async (args) => {
  const {
    system,
    chatId,
    initialMessageCount,
    sbUserId,
    assignment,
    tools: toolPolicy,
    ...options
  } = args;
  const research = toolPolicy?.research === true;
  const limits = subagentRunLimits(research);

  let messages = options.messages;
  let prepared = await prepareWorkerTools({
    chatId,
    initialMessageCount,
    sbUserId,
    assignment,
    system,
    toolPolicy,
    model: options.model,
    messages,
  });
  const historyMode = assignment ? readSubagentContext(assignment)?.history.mode : undefined;

  if (
    (!historyMode || historyMode === "continue") &&
    prepared.budget.estimatedInputTokens + prepared.budget.reservedToolTokens >
      prepared.budget.inputLimitTokens &&
    messages.length > 1
  ) {
    const trimmed = trimModelMessagesToPreflight({
      messages,
      instructions: prepared.instructions,
      toolSchemaText: prepared.toolSchemaText,
      modelId: options.model,
    });

    if (trimmed.messages.length < messages.length) {
      messages = trimmed.messages;
      prepared = trimmed.inspection.fits
        ? await prepareWorkerTools({
            chatId,
            initialMessageCount: messages.length,
            sbUserId,
            assignment,
            system,
            toolPolicy,
            model: options.model,
            messages,
          })
        : { ...prepared, budget: trimmed.inspection.budget };
    }
  }

  const { tools, instructions, toolSchemaText, budget } = prepared;

  if (
    assignment &&
    readSubagentContext(assignment) &&
    budget.estimatedInputTokens + budget.reservedToolTokens > budget.inputLimitTokens
  )
    throw new Error(
      `Subagent input needs ${budget.estimatedInputTokens} estimated tokens plus ${budget.reservedToolTokens} for tool results. Select less history/context or start a fresh assignment.`
    );

  const hasTools = Object.keys(tools).length > 0;
  const budgetHooks = createLlmBudgetHooks({
    ownerId: sbUserId,
    modelId: options.model,
    operation: "subagent_worker",
    route: "/api/chat/queue",
  });

  const result = await generateText({
    ...options,
    messages,
    ...withSubagentCostLimits(budgetHooks, {
      instructions,
      toolSchemaText,
      research,
      modelId: options.model,
    }),
    instructions,
    maxOutputTokens: limits.maxOutputTokens,
    tools,
    toolChoice: hasTools ? "auto" : "none",
    stopWhen: isStepCount(limits.maxSteps),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(180_000),
  });

  return {
    text: result.text,
    ...(research ? { toolParts: researchToolParts(result.steps) } : {}),
    usage: result.totalUsage,
    providerMetadata: result.providerMetadata,
    contextUsage: summarizeContextBudgetUsage(options.model, result.steps, true),
  };
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
    const recent = await store.loadMessages(threadId, SUBAGENT_THREAD_CONTEXT_MESSAGES);
    const assignment =
      input.assignment ??
      recent.find((message) => message.id === goal.goalId) ??
      buildSubagentGoalMessage({ goal: goal.goal, goalId: goal.goalId, id: goal.goalId });
    const context = readSubagentContext(assignment);
    let history = recent.filter((message) => message.id !== assignment.id);

    if (context) {
      const frozen = await Promise.all(
        context.history.messageIds.map(async (id) => {
          const message =
            history.find((candidate) => candidate.id === id) ??
            (await store.loadMessage?.(threadId, id));

          if (!message)
            throw new Error(
              "Selected assignment history is no longer available. Dispatch again with current history or fresh mode."
            );

          return message;
        })
      );

      history = frozen;
    }

    const result = await generate({
      chatId: threadId,
      initialMessageCount: history.length + 1,
      assignment,
      sbUserId: input.ownerId,
      model: input.modelId,
      system: input.lockedPersona
        ? buildLockedWorkerSystem(input.lockedPersona)
        : buildSubagentThreadSystem(input.workerName, input.workerRole),
      ...(input.lockedPersona ? { tools: input.lockedPersona.tools } : {}),
      messages: await workerModelMessages(history, assignment),
      providerOptions: {
        gateway: {
          zeroDataRetention: input.zeroDataRetention,
          ...gatewayAttribution({ userId: input.ownerId, operation: "subagent_worker" }),
        },
      },
    });

    // The production generator meters each step. Injected generators retain their recorder.
    if (input.generate)
      await input.recordUsage?.({
        modelId: input.modelId,
        usage: result.usage,
        providerMetadata: result.providerMetadata,
      });

    const text = result.text.trim() || "I finished without anything to report.";

    const saved = await store.appendMessages(threadId, [
      buildSubagentReplyMessage({
        text,
        toolParts: result.toolParts,
        goalId: goal.goalId,
        modelId: input.modelId,
        contextUsage:
          result.contextUsage ??
          (result.usage
            ? summarizeContextBudgetUsage(
                input.modelId,
                [{ usage: result.usage, providerMetadata: result.providerMetadata }],
                true
              )
            : undefined),
      }),
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
