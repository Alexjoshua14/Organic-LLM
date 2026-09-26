import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type { WorkerAwarenessEvent } from "@/lib/schemas/subagent-runtime";
import type { WorkerGoal } from "@/lib/schemas/subagent-runtime";

/**
 * Apply one orchestrator-awareness event onto a roster agent.
 * Pure — no Speak side effects (caller may push Speak for milestones).
 */
export function applyWorkerAwarenessToSubagent(
  agent: ArcadiaSubagent,
  event: WorkerAwarenessEvent
): ArcadiaSubagent {
  if (event.agentId !== agent.id) return agent;

  if (event.kind === "progress") {
    return {
      ...agent,
      goal: event.assignedGoal ?? agent.goal,
      progress: event.narrative,
      progressPct: event.progressPct,
      status: "working",
    };
  }

  if (event.kind === "milestone") {
    return {
      ...agent,
      milestones: [
        ...agent.milestones,
        {
          id: event.milestone.id,
          label: event.milestone.label,
          at: event.milestone.at,
        },
      ],
      status: agent.status === "idle" ? "working" : agent.status,
    };
  }

  if (event.kind === "completion") {
    return {
      ...agent,
      progress: event.summary,
      progressPct: 100,
      status: "done",
    };
  }

  // failure — surface short error; never pretend near-done.
  return {
    ...agent,
    progress: event.error,
    status: "blocked",
  };
}

/** Adopt assigned goals from a dispatch onto matching roster slots. */
export function applyAssignedGoalsToRoster(
  agents: ReadonlyArray<ArcadiaSubagent>,
  goals: ReadonlyArray<Pick<WorkerGoal, "agentId" | "goal">>
): ArcadiaSubagent[] {
  if (goals.length === 0) return [...agents];

  const byAgent = new Map<string, string>();
  for (const g of goals) {
    byAgent.set(g.agentId, g.goal);
  }

  return agents.map((agent) => {
    const goal = byAgent.get(agent.id);
    if (!goal) return agent;
    return {
      ...agent,
      goal,
      progress: "Accepted — starting model run.",
      progressPct: 0,
      status: "working" as const,
    };
  });
}
