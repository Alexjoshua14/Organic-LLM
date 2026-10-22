import type { SubagentThreadSnapshot } from "@/lib/llm/subagents/threads/snapshot";
import type {
  SubagentBudgetSnapshot,
  SubagentPlanBudgetInput,
} from "@/lib/llm/subagents/orchestrator/cost-policy";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import {
  getHardSetSubagent,
  listRosterHardSetSubagents,
} from "@/lib/llm/subagents/hard-set/registry";
import { formatSubagentCostPolicy } from "@/lib/llm/subagents/orchestrator/cost-policy";
import {
  ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES,
  ORCHESTRATOR_MAX_DISPATCHES_PER_TURN,
} from "@/lib/llm/subagents/orchestrator/constants";
import { formatWorkbenchCompactGuide } from "@/lib/llm/subagents/worktable/manpages";
import {
  formatConnectorSpecialistRouting,
  type UserConnectorsProfile,
} from "@/lib/schemas/user-connectors";

function autonomyLine(
  autonomous: boolean,
  autonomousRemaining: number | null,
  maxDispatchesPerTurn: number
): string {
  if (!autonomous) {
    return `You may direct subagents within the user's requested scope and the cost policy below. At most ${maxDispatchesPerTurn} dispatches per turn; automatic heartbeat turns may dispatch at most ${ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES} time(s) between user messages.`;
  }
  if (!autonomousRemaining) {
    return "This is an automatic turn after a subagent update, and the automatic dispatch allowance is spent until the user speaks again. Tell the user what you would send next.";
  }

  return `This is an automatic turn after a subagent update. Relay the result and finish here when possible. Dispatch only a necessary next step of work the user already asked for that cannot be completed with your existing context and tools. You may dispatch ${autonomousRemaining} more time(s) before the user speaks again. Do not start review or judging cycles on your own.`;
}

/**
 * System fragment for orchestrator-authored dispatch (COA-258): the orchestrator's role, how to
 * write a brief, its autonomy bounds, and the roster it can direct.
 */
export function formatOrchestratorFragment(args: {
  snapshots: ReadonlyArray<SubagentThreadSnapshot>;
  autonomous: boolean;
  /** Automatic dispatches left before the user speaks again; null on user turns. */
  autonomousRemaining: number | null;
  budget?: SubagentBudgetSnapshot | SubagentPlanBudgetInput | null;
  maxDispatchesPerTurn?: number;
  /** Private Settings → Connectors profile. Adds Reed / Lyra / Archer routing when populated. */
  connectors?: UserConnectorsProfile | null;
}): string {
  const connectorRouting = formatConnectorSpecialistRouting(args.connectors);
  const maxDispatchesPerTurn =
    args.maxDispatchesPerTurn ??
    (args.budget && "maxParallelDispatches" in args.budget
      ? args.budget.maxParallelDispatches
      : ORCHESTRATOR_MAX_DISPATCHES_PER_TURN);
  const byAgent = new Map(args.snapshots.map((s) => [s.agentId, s]));
  const slots = createDemoSubagents();
  const locked = listRosterHardSetSubagents().filter((a) => !a.rosterSlotId);
  const slotIds = new Set([...slots.map((s) => s.id), ...locked.map((a) => a.id)]);
  const roster = [
    ...slots.map(
      (s) =>
        `- ${s.name} (${s.role}, agentId=${s.id}) — ${byAgent.get(s.id)?.status ?? "idle"}. ${s.blurb}${getHardSetSubagent(s.id)?.roster ? " Locked persona: give it assignments within its role; it will not take on another role." : ""}`
    ),
    ...locked.map(
      (a) =>
        `- ${a.name} (${a.role}, agentId=${a.id}) — ${byAgent.get(a.id)?.status ?? "idle"}. ${a.blurb} Locked persona: give it assignments within its role; it will not take on another role.`
    ),
    ...args.snapshots
      .filter((s) => !slotIds.has(s.agentId))
      .map((s) => `- ${s.name} (${s.role}, agentId=${s.agentId}) — ${s.status}`),
  ];

  return [
    "[Orchestrator]",
    "You orchestrate Arcadia's subagents. Nothing reaches a subagent unless you send it with dispatch_subagent; each sees only its own thread — never this conversation or the other subagents' threads.",
    formatSubagentCostPolicy(args.budget),
    "- Write each brief in your own words so it stands alone: the actual task (not the user's message pasted), why it matters, constraints, the deliverable, and when it is done.",
    "- Attach what the subagent needs: the user's exact words where they matter (user_message), other subagents' results (subagent_output), relevant memories (memory), and your own notes.",
    "- Select bundle items and offset/limit excerpts deliberately. Use a dryRun to inspect the complete input budget before dispatch. Continue preserves history/cache; use fresh for independent tasks or historyMessageIds for exact prior messages. Preserve required constraints and evidence. A marked preview can be expanded with read_context_item in the recipient's own assignment.",
    "- Keep reusable context on your worktable. Build a bundle once — for example a reviewer's rubric plus a live_subagent_output slot for the coder's latest work — then send it again, updating single items instead of rebuilding.",
    `- ${autonomyLine(args.autonomous, args.autonomousRemaining, maxDispatchesPerTurn)}`,
    "- After dispatching, tell the user briefly who is doing what. Do not do delegated work inline.",
    "Roster:",
    ...roster,
    "",
    formatWorkbenchCompactGuide(),
    ...(connectorRouting ? ["", connectorRouting] : []),
  ].join("\n");
}
