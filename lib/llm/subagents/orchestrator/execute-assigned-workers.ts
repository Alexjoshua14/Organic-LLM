import type { WorkerAwarenessEvent, WorkerGoal } from "@/lib/schemas/subagent-runtime";

import {
  defaultOrchestratorAwarenessBus,
  type OrchestratorAwarenessBus,
} from "@/lib/llm/subagents/orchestrator/awareness";
import type { ThoughtRouterWorker } from "@/lib/llm/subagents/orchestrator/thought-router";
import {
  runWorkerGoalWithModel,
  type WorkerGenerateText,
} from "@/lib/llm/subagents/worker/run-with-model";
import type { RunWorkerGoalResult } from "@/lib/llm/subagents/worker/run";

export type ExecuteAssignedWorkersInput = {
  goals: ReadonlyArray<WorkerGoal>;
  /** Resolved chat model id for this turn (not Jev). */
  modelId: string;
  workers?: ReadonlyArray<ThoughtRouterWorker>;
  bus?: OrchestratorAwarenessBus;
  generateText?: WorkerGenerateText;
  now?: () => number;
  onEvent?: (event: WorkerAwarenessEvent) => void;
};

export type ExecuteAssignedWorkersResult = {
  results: RunWorkerGoalResult[];
};

/**
 * Run every assigned worker goal with a real model call.
 * Goals for the same agent run sequentially; different agents run in parallel.
 */
export async function executeAssignedWorkers(
  input: ExecuteAssignedWorkersInput
): Promise<ExecuteAssignedWorkersResult> {
  if (input.goals.length === 0) {
    return { results: [] };
  }

  const bus = input.bus ?? defaultOrchestratorAwarenessBus;
  const byAgent = new Map<string, WorkerGoal[]>();

  for (const goal of input.goals) {
    const list = byAgent.get(goal.agentId) ?? [];
    list.push(goal);
    byAgent.set(goal.agentId, list);
  }

  const rosterById = new Map((input.workers ?? []).map((w) => [w.id, w]));

  const results = await Promise.all(
    [...byAgent.entries()].map(async ([agentId, goals]) => {
      const meta = rosterById.get(agentId);
      const agentResults: RunWorkerGoalResult[] = [];

      for (const goal of goals) {
        agentResults.push(
          await runWorkerGoalWithModel({
            goal,
            modelId: input.modelId,
            workerName: meta?.name,
            workerRole: meta?.role,
            bus,
            generateText: input.generateText,
            now: input.now,
            onEvent: input.onEvent,
          })
        );
      }

      return agentResults;
    })
  );

  return { results: results.flat() };
}
