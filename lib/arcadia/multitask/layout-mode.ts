import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

/**
 * Overlay = idle Multitask drawer over full-screen chat.
 * Dashboard = running workers; chat is confined beside the agent board.
 */
export type ArcadiaMultitaskLayoutMode = "overlay" | "dashboard";

/** Where the Arcadia composer is explicitly addressing outbound text. */
export type ArcadiaMultitaskSendTarget =
  | { kind: "orchestrator" }
  | { kind: "subagent"; agentId: string };

export const DEFAULT_MULTITASK_SEND_TARGET: ArcadiaMultitaskSendTarget = {
  kind: "orchestrator",
};

/** Statuses that count as "running" for the dashboard layout switch. */
export const ARCADIA_RUNNING_STATUSES = new Set<ArcadiaSubagent["status"]>(["working", "blocked"]);

export function isArcadiaSubagentRunning(agent: Pick<ArcadiaSubagent, "status">): boolean {
  return ARCADIA_RUNNING_STATUSES.has(agent.status);
}

/**
 * Pure layout choice: any running worker → dashboard; otherwise keep today's overlay shell.
 */
export function resolveArcadiaMultitaskLayoutMode(
  agents: ReadonlyArray<Pick<ArcadiaSubagent, "status">>
): ArcadiaMultitaskLayoutMode {
  return agents.some(isArcadiaSubagentRunning) ? "dashboard" : "overlay";
}

export function formatSendTargetLabel(
  target: ArcadiaMultitaskSendTarget,
  agents: ReadonlyArray<Pick<ArcadiaSubagent, "id" | "name">>
): string {
  if (target.kind === "orchestrator") return "Orchestrator";

  const agent = agents.find((a) => a.id === target.agentId);

  return agent?.name ?? "Subagent";
}
