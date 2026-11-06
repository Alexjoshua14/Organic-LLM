"use client";

import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { useEffect, useReducer } from "react";

import {
  isSubagentVisible,
  subagentVisibilityDeadline,
} from "@/lib/arcadia/multitask/agent-visibility";
import { isArcadiaSubagentRunning } from "@/lib/arcadia/multitask/layout-mode";

export function useVisibleSubagents(
  agents: ReadonlyArray<ArcadiaSubagent>,
  pinnedIds: ReadonlyArray<string | null>
) {
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);
  const now = Date.now();
  const nextDeadline = Math.min(
    ...agents
      .filter((agent) => !isArcadiaSubagentRunning(agent) && !pinnedIds.includes(agent.id))
      .map(subagentVisibilityDeadline)
      .filter((deadline) => deadline > now)
  );

  useEffect(() => {
    if (!Number.isFinite(nextDeadline)) return;

    const timer = window.setTimeout(refresh, Math.max(0, nextDeadline - Date.now()));

    return () => window.clearTimeout(timer);
  }, [nextDeadline]);

  return agents.filter((agent) => isSubagentVisible(agent, now, pinnedIds));
}
