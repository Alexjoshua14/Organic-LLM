import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";

/** Display identity for a subagent slot, resolvable on the server without client state. */
export type SubagentIdentityLite = {
  agentId: string;
  name: string;
  role: string;
  blurb: string;
};

/** `worker-<suggestedRole>-<8 hex>` as minted by `dispatchMultitaskInbound`. */
const PROVISIONAL_WORKER_ID = /^worker-(.+)-[0-9a-f]{8}$/i;

function titleCase(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) return "Worker";

  return `${trimmed[0]!.toUpperCase()}${trimmed.slice(1)}`;
}

function rosterSlots(): SubagentIdentityLite[] {
  return createDemoSubagents().map((a) => ({
    agentId: a.id,
    name: a.name,
    role: a.role,
    blurb: a.blurb,
  }));
}

/**
 * Name and role for a roster slot (`agent-researcher` → Lyra) or a provisional worker id minted
 * by the router (`worker-analyst-1a2b3c4d` → Analyst).
 */
export function resolveSubagentIdentity(agentId: string): SubagentIdentityLite {
  const slot = rosterSlots().find((s) => s.agentId === agentId);

  if (slot) return slot;

  const provisional = PROVISIONAL_WORKER_ID.exec(agentId);
  const role = provisional?.[1]?.trim().toLowerCase() || "generalist";

  return {
    agentId,
    name: provisional ? titleCase(role) : agentId,
    role,
    blurb: "Spawned by the orchestrator for one thread of work.",
  };
}

/**
 * Map a router `new_subagent` suggestion onto an idle roster slot with the same role, so repeat
 * thoughts land in one thread instead of minting a fresh provisional worker every turn.
 */
export function pickRosterSlotForRole(
  suggestedRole: string,
  options: { busyAgentIds?: ReadonlySet<string> } = {}
): string | null {
  const role = suggestedRole.trim().toLowerCase();

  if (!role) return null;

  const slot = rosterSlots().find(
    (s) => s.role.toLowerCase() === role && !options.busyAgentIds?.has(s.agentId)
  );

  return slot?.agentId ?? null;
}
