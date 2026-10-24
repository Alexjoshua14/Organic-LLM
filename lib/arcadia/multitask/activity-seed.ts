import type { ArcadiaSubagent } from "./types";

/** Snapshot the starting context into a small, deterministic seed for the decorative dots. */
export function createSubagentActivitySeed(
  agent: Pick<ArcadiaSubagent, "id" | "name" | "role" | "blurb" | "goal">
): string {
  const context = JSON.stringify([agent.id, agent.name, agent.role, agent.blurb, agent.goal]);
  let hash = 2166136261;

  for (let index = 0; index < context.length; index++) {
    hash = Math.imul(hash ^ context.charCodeAt(index), 16777619);
  }

  return `subagent-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
