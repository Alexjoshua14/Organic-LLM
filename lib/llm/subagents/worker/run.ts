import type {
  WorkerAwarenessEvent,
  WorkerGoal,
  WorkerMilestone,
} from "@/lib/schemas/subagent-runtime";

import {
  defaultOrchestratorAwarenessBus,
  type OrchestratorAwarenessBus,
} from "@/lib/llm/subagents/orchestrator/awareness";
import type { AgentRuntimeRole } from "@/lib/llm/subagents/roles";

export type WorkerStep =
  | { kind: "progress"; narrative: string; progressPct: number }
  | { kind: "milestone"; milestone: Omit<WorkerMilestone, "at"> }
  | { kind: "completion"; summary: string };

export type RunWorkerGoalInput = {
  goal: WorkerGoal;
  /** Ordered steps the worker performs while pursuing the goal. */
  steps: WorkerStep[];
  bus?: OrchestratorAwarenessBus;
  now?: () => number;
};

export type RunWorkerGoalResult = {
  runtimeRole: Extract<AgentRuntimeRole, "worker">;
  goalId: string;
  events: WorkerAwarenessEvent[];
  completed: boolean;
};

/**
 * Worker path: pursue the assigned goal and report progress, milestones, and
 * completion back to the orchestrator via the awareness bus.
 */
export async function runWorkerGoal(input: RunWorkerGoalInput): Promise<RunWorkerGoalResult> {
  const bus = input.bus ?? defaultOrchestratorAwarenessBus;
  const now = input.now ?? Date.now;
  const events: WorkerAwarenessEvent[] = [];
  let completed = false;

  for (const step of input.steps) {
    const at = now();
    let event: WorkerAwarenessEvent;

    if (step.kind === "progress") {
      event = {
        kind: "progress",
        goalId: input.goal.goalId,
        agentId: input.goal.agentId,
        narrative: step.narrative,
        progressPct: step.progressPct,
        at,
      };
    } else if (step.kind === "milestone") {
      event = {
        kind: "milestone",
        goalId: input.goal.goalId,
        agentId: input.goal.agentId,
        milestone: { ...step.milestone, at },
        at,
      };
    } else {
      event = {
        kind: "completion",
        goalId: input.goal.goalId,
        agentId: input.goal.agentId,
        summary: step.summary,
        at,
      };
      completed = true;
    }

    events.push(event);
    bus.publish(input.goal.orchestratorId, event);
  }

  return {
    runtimeRole: "worker",
    goalId: input.goal.goalId,
    events,
    completed,
  };
}
