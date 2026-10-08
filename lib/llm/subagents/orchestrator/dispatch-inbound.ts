import { randomUUID } from "crypto";

import type { ArcadiaMultitaskSendTargetParsed } from "@/lib/schemas/arcadia-multitask-send-target";
import type { MultitaskInboundDispatch } from "@/lib/schemas/thought-routing";
import { resolveMultitaskSendTarget } from "@/lib/schemas/arcadia-multitask-send-target";

import {
  createWorkerGoal,
  decideOrchestratorDelegation,
} from "@/lib/llm/subagents/orchestrator/delegate";
import { ORCHESTRATOR_RETURN_TARGET_MS } from "@/lib/llm/subagents/orchestrator/constants";
import {
  createJevThoughtRouter,
  type ThoughtRouter,
  type ThoughtRouterWorker,
} from "@/lib/llm/subagents/orchestrator/thought-router";

export type DispatchMultitaskInboundInput = {
  text: string;
  sendTarget?: ArcadiaMultitaskSendTargetParsed | null;
  workers: ReadonlyArray<ThoughtRouterWorker>;
  orchestratorId?: string;
  router?: ThoughtRouter;
  now?: () => number;
  /**
   * Map a `new_subagent` suggestion onto an existing slot (e.g. an idle roster slot of the same
   * role) so repeat thoughts reuse one thread. Null keeps the provisional worker id.
   */
  resolveNewSubagentId?: (suggestedRole: string) => string | null;
};

export type DispatchMultitaskInboundResult = MultitaskInboundDispatch & {
  /** Worker goals assigned this turn (existing match or new). */
  assignedGoals: ReturnType<typeof createWorkerGoal>[];
  /** Direct thought texts the orchestrator should answer inline. */
  directThoughts: string[];
  /** Orchestrator return-budget bookkeeping for this dispatch. */
  elapsedMs: number;
  returnedWithinTarget: boolean;
};

/**
 * Honor the Arcadia multitask send target:
 * - orchestrator (or absent) → split/route thoughts
 * - specific subagent → deliver whole message to that worker only (no re-split)
 */
export async function dispatchMultitaskInbound(
  input: DispatchMultitaskInboundInput
): Promise<DispatchMultitaskInboundResult> {
  const started = (input.now ?? Date.now)();
  const sendTarget = resolveMultitaskSendTarget(input.sendTarget);
  const orchestratorId = input.orchestratorId ?? "aion-orchestrator";
  const text = input.text.trim() || input.text;

  if (sendTarget.kind === "subagent") {
    const goal = createWorkerGoal({
      orchestratorId,
      workerAgentId: sendTarget.agentId,
      goal: text,
      now: started,
    });
    // Mark as long work so the orchestrator does not try to answer inline.
    decideOrchestratorDelegation(
      { estimatedDurationMs: ORCHESTRATOR_RETURN_TARGET_MS + 1, forceDelegate: true },
      {
        orchestratorId,
        workerAgentId: sendTarget.agentId,
        goal: text,
        now: started,
        goalId: goal.goalId,
      }
    );

    const elapsedMs = (input.now ?? Date.now)() - started;

    return {
      sendTarget,
      mode: "direct_to_subagent",
      deliveredAgentId: sendTarget.agentId,
      deliveredText: text,
      assignedGoals: [goal],
      directThoughts: [],
      elapsedMs,
      returnedWithinTarget: elapsedMs <= ORCHESTRATOR_RETURN_TARGET_MS,
    };
  }

  const router = input.router ?? createJevThoughtRouter();
  const routing = await router.route({ text, workers: input.workers });

  const assignedGoals: ReturnType<typeof createWorkerGoal>[] = [];
  const directThoughts: string[] = [];

  for (const thought of routing.thoughts) {
    if (thought.disposition.kind === "direct") {
      directThoughts.push(thought.text);
      continue;
    }

    if (thought.disposition.kind === "existing_subagent") {
      assignedGoals.push(
        createWorkerGoal({
          orchestratorId,
          workerAgentId: thought.disposition.agentId,
          goal: thought.text,
          now: (input.now ?? Date.now)(),
        })
      );
      continue;
    }

    // new_subagent — reuse a slot when the caller maps one; otherwise a provisional id.
    const workerAgentId =
      input.resolveNewSubagentId?.(thought.disposition.suggestedRole) ??
      `worker-${thought.disposition.suggestedRole}-${randomUUID().slice(0, 8)}`;
    assignedGoals.push(
      createWorkerGoal({
        orchestratorId,
        workerAgentId,
        goal: thought.text,
        now: (input.now ?? Date.now)(),
      })
    );
  }

  const elapsedMs = (input.now ?? Date.now)() - started;

  return {
    sendTarget,
    mode: "routed",
    routing,
    assignedGoals,
    directThoughts,
    elapsedMs,
    returnedWithinTarget: elapsedMs <= ORCHESTRATOR_RETURN_TARGET_MS,
  };
}
