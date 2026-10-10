import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";

import { architectSubagent } from "@/lib/llm/subagents/hard-set/agents/architect";

/** Every hard-set subagent. Add new ones here (the `new-subagent` skill does it for you). */
export const HARD_SET_SUBAGENTS: ReadonlyArray<HardSetSubagent> = [architectSubagent];

export function getHardSetSubagent(id: string | null | undefined): HardSetSubagent | null {
  if (!id) return null;

  return HARD_SET_SUBAGENTS.find((agent) => agent.id === id) ?? null;
}
