import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";

import { architectSubagent } from "@/lib/llm/subagents/hard-set/agents/architect";
import { coderSubagent } from "@/lib/llm/subagents/hard-set/agents/coder";
import { researcherSubagent } from "@/lib/llm/subagents/hard-set/agents/researcher";

/** Every hard-set subagent. Add new ones here (the `new-subagent` skill does it for you). */
export const HARD_SET_SUBAGENTS: ReadonlyArray<HardSetSubagent> = [
  architectSubagent,
  researcherSubagent,
  coderSubagent,
];

/** Hard-set subagents locked into the orchestrator's roster. */
export function listRosterHardSetSubagents(): ReadonlyArray<HardSetSubagent> {
  return HARD_SET_SUBAGENTS.filter((agent) => agent.roster);
}

export function getHardSetSubagent(id: string | null | undefined): HardSetSubagent | null {
  if (!id) return null;

  return (
    HARD_SET_SUBAGENTS.find(
      (agent) => agent.id === id || (agent.roster && agent.rosterSlotId === id)
    ) ?? null
  );
}
