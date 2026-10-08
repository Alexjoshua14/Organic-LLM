import { randomUUID } from "crypto";

import { generateText } from "ai";

import type { WorkerAwarenessEvent, WorkerGoal } from "@/lib/schemas/subagent-runtime";
import { DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";

import {
  defaultOrchestratorAwarenessBus,
  type OrchestratorAwarenessBus,
} from "@/lib/llm/subagents/orchestrator/awareness";
import type { AgentRuntimeRole } from "@/lib/llm/subagents/roles";
import type { RunWorkerGoalResult } from "@/lib/llm/subagents/worker/run";

export type WorkerGenerateText = (args: {
  model: string;
  system: string;
  prompt: string;
}) => Promise<{ text: string }>;

export type RunWorkerGoalWithModelInput = {
  goal: WorkerGoal;
  /** Thread-selected chat model id when present; otherwise app default. */
  modelId?: string;
  workerName?: string;
  workerRole?: string;
  bus?: OrchestratorAwarenessBus;
  generateText?: WorkerGenerateText;
  now?: () => number;
  /** Optional side channel (e.g. UI stream writer). */
  onEvent?: (event: WorkerAwarenessEvent) => void;
};

export function shortError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Worker model call failed";
  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed;
}

export function summarizeOutcome(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Worker finished with an empty response.";
  return cleaned.length > 600 ? `${cleaned.slice(0, 597)}…` : cleaned;
}

export function milestoneFromOutcome(summary: string): string {
  const first = summary.split(/(?<=[.!?])\s+/)[0]?.trim() ?? summary;
  const label = first.length > 140 ? `${first.slice(0, 137)}…` : first;
  return label || "Worker completed assigned goal";
}

export function buildWorkerSystem(name?: string, role?: string): string {
  const who = name?.trim() || "Worker";
  const asRole = role?.trim() || "specialist";
  return [
    `You are ${who}, a ${asRole} subagent in Organic LLM's Arcadia multitask shell.`,
    "Pursue the assigned goal carefully and reply with a concise, usable outcome.",
    "Do not invent tool results, costs, tokens, or progress percentages.",
    "Do not open a voice session. Write only the work product / conclusion.",
  ].join(" ");
}

/**
 * Real worker path: one model call for the assigned goal, with awareness events
 * published for the orchestrator (and optional stream consumers).
 */
export async function runWorkerGoalWithModel(
  input: RunWorkerGoalWithModelInput
): Promise<RunWorkerGoalResult> {
  const bus = input.bus ?? defaultOrchestratorAwarenessBus;
  const now = input.now ?? Date.now;
  const modelId = input.modelId?.trim() || DEFAULT_CHAT_MODEL.id;
  const gen = input.generateText ?? ((args) => generateText(args));
  const events: WorkerAwarenessEvent[] = [];

  const publish = (event: WorkerAwarenessEvent) => {
    events.push(event);
    bus.publish(input.goal.orchestratorId, event);
    input.onEvent?.(event);
  };

  publish({
    kind: "progress",
    goalId: input.goal.goalId,
    agentId: input.goal.agentId,
    narrative: `Accepted goal — calling model.`,
    progressPct: 0,
    at: now(),
    assignedGoal: input.goal.goal,
  });

  try {
    const result = await gen({
      model: modelId,
      system: buildWorkerSystem(input.workerName, input.workerRole),
      prompt: input.goal.goal,
    });

    const summary = summarizeOutcome(result.text);
    const milestoneLabel = milestoneFromOutcome(summary);

    publish({
      kind: "progress",
      goalId: input.goal.goalId,
      agentId: input.goal.agentId,
      narrative: summary,
      progressPct: 100,
      at: now(),
    });

    publish({
      kind: "milestone",
      goalId: input.goal.goalId,
      agentId: input.goal.agentId,
      milestone: { id: randomUUID(), label: milestoneLabel, at: now() },
      at: now(),
    });

    publish({
      kind: "completion",
      goalId: input.goal.goalId,
      agentId: input.goal.agentId,
      summary,
      at: now(),
    });

    return {
      runtimeRole: "worker" satisfies Extract<AgentRuntimeRole, "worker">,
      goalId: input.goal.goalId,
      events,
      completed: true,
    };
  } catch (err) {
    publish({
      kind: "failure",
      goalId: input.goal.goalId,
      agentId: input.goal.agentId,
      error: shortError(err),
      at: now(),
    });

    return {
      runtimeRole: "worker",
      goalId: input.goal.goalId,
      events,
      completed: false,
    };
  }
}
