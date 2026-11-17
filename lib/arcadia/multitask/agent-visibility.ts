import type { ArcadiaSubagent } from "./types";

import { isArcadiaSubagentRunning } from "./layout-mode";

/** Keep a finished agent around long enough to notice its result, without leaving idle slots. */
export const MULTITASK_RECENT_ACTIVITY_MS = 30_000;

export function subagentVisibilityDeadline(agent: ArcadiaSubagent): number {
  return agent.statusAt != null && Number.isFinite(agent.statusAt)
    ? agent.statusAt + MULTITASK_RECENT_ACTIVITY_MS
    : 0;
}

export function isSubagentVisible(
  agent: ArcadiaSubagent,
  now: number,
  pinnedIds: ReadonlyArray<string | null> = []
): boolean {
  return (
    isArcadiaSubagentRunning(agent) ||
    pinnedIds.includes(agent.id) ||
    subagentVisibilityDeadline(agent) > now
  );
}
