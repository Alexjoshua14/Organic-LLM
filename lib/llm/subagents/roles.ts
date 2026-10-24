/**
 * Internal agent runtime roles for Organic LLM.
 *
 * Distinct from Arcadia/domain display roles (`researcher`, `coder`, …) and from
 * the L0/L1/L2 layering in `lib/llm/subagents/README.md`. This axis answers:
 * is this agent free for the user (orchestrator) or assigned a goal (worker)?
 */
export const AGENT_RUNTIME_ROLES = ["orchestrator", "worker"] as const;

export type AgentRuntimeRole = (typeof AGENT_RUNTIME_ROLES)[number];

export function isAgentRuntimeRole(value: unknown): value is AgentRuntimeRole {
  return value === "orchestrator" || value === "worker";
}

/** User-facing L0 (Aion) is always an orchestrator in this model. */
export const AION_RUNTIME_ROLE: AgentRuntimeRole = "orchestrator";
