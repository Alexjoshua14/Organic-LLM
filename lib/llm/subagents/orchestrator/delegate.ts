import { randomUUID } from "crypto";

import type { WorkerGoal } from "@/lib/schemas/subagent-runtime";

import { ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS } from "@/lib/llm/subagents/orchestrator/constants";
import type { AgentRuntimeRole } from "@/lib/llm/subagents/roles";

export type TaskComplexityHint = {
  /** Caller estimate of how long the work will take if done inline. */
  estimatedDurationMs: number;
  /** Explicit override — when true, always spawn a worker. */
  forceDelegate?: boolean;
};

export type DelegateDecision =
  | {
      action: "delegate";
      reason: "long-work" | "forced";
      goal: WorkerGoal;
    }
  | {
      action: "inline";
      reason: "within-return-budget";
    };

export type CreateWorkerGoalInput = {
  orchestratorId: string;
  workerAgentId: string;
  goal: string;
  now?: number;
  goalId?: string;
};

export function createWorkerGoal(input: CreateWorkerGoalInput): WorkerGoal {
  return {
    goalId: input.goalId ?? randomUUID(),
    agentId: input.workerAgentId,
    goal: input.goal.trim(),
    assignedAt: input.now ?? Date.now(),
    orchestratorId: input.orchestratorId,
  };
}

/**
 * Orchestrators acknowledge and delegate long work; they do not run it inline.
 * Short acknowledgments / routing stay inline so the orchestrator returns
 * within {@link ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS}.
 */
export function decideOrchestratorDelegation(
  hint: TaskComplexityHint,
  assignment: CreateWorkerGoalInput
): DelegateDecision {
  if (hint.forceDelegate || hint.estimatedDurationMs > ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS) {
    return {
      action: "delegate",
      reason: hint.forceDelegate ? "forced" : "long-work",
      goal: createWorkerGoal(assignment),
    };
  }

  return { action: "inline", reason: "within-return-budget" };
}

export type OrchestratorTurnResult =
  | {
      runtimeRole: Extract<AgentRuntimeRole, "orchestrator">;
      disposition: "delegated";
      acknowledgment: string;
      workerGoal: WorkerGoal;
      /** Wall-clock for the orchestrator's return path (not worker runtime). */
      returnedWithinTarget: boolean;
      elapsedMs: number;
    }
  | {
      runtimeRole: Extract<AgentRuntimeRole, "orchestrator">;
      disposition: "inline";
      acknowledgment: string;
      returnedWithinTarget: boolean;
      elapsedMs: number;
    };

export type RunOrchestratorTurnInput = {
  orchestratorId: string;
  userRequest: string;
  workerAgentId: string;
  complexity: TaskComplexityHint;
  /** Injected clock for tests. */
  now?: () => number;
  /** Optional recorder when a worker goal is assigned. */
  onWorkerGoalAssigned?: (goal: WorkerGoal) => void | Promise<void>;
};

/**
 * Short orchestrator turn: decide, optionally record a worker goal, return.
 * Does not execute the worker body — that is {@link runWorkerGoal}.
 */
export async function runOrchestratorTurn(
  input: RunOrchestratorTurnInput
): Promise<OrchestratorTurnResult> {
  const started = (input.now ?? Date.now)();
  const decision = decideOrchestratorDelegation(input.complexity, {
    orchestratorId: input.orchestratorId,
    workerAgentId: input.workerAgentId,
    goal: input.userRequest,
    now: started,
  });

  if (decision.action === "delegate") {
    await input.onWorkerGoalAssigned?.(decision.goal);
    const elapsedMs = (input.now ?? Date.now)() - started;
    return {
      runtimeRole: "orchestrator",
      disposition: "delegated",
      acknowledgment: `Delegated to worker ${decision.goal.agentId}: ${decision.goal.goal}`,
      workerGoal: decision.goal,
      returnedWithinTarget: elapsedMs <= ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS,
      elapsedMs,
    };
  }

  const elapsedMs = (input.now ?? Date.now)() - started;
  return {
    runtimeRole: "orchestrator",
    disposition: "inline",
    acknowledgment: input.userRequest,
    returnedWithinTarget: elapsedMs <= ORCHESTRATOR_INLINE_MAX_ESTIMATED_MS,
    elapsedMs,
  };
}
