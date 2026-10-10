import type { SubagentThreadSnapshot } from "@/lib/llm/subagents/threads/snapshot";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import {
  ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES,
  ORCHESTRATOR_MAX_DISPATCHES_PER_TURN,
} from "@/lib/llm/subagents/orchestrator/constants";

function autonomyLine(autonomous: boolean, autonomousRemaining: number | null): string {
  if (!autonomous) {
    return `You may direct subagents on your own initiative — for example, send finished work to a reviewer. At most ${ORCHESTRATOR_MAX_DISPATCHES_PER_TURN} dispatches per turn; automatic heartbeat turns may dispatch at most ${ORCHESTRATOR_MAX_AUTONOMOUS_DISPATCHES} times between user messages.`;
  }
  if (autonomousRemaining === null) {
    return "This is an automatic turn and the worktable is unavailable, so you cannot dispatch. Tell the user what you would send next.";
  }
  if (autonomousRemaining === 0) {
    return "This is an automatic turn and the automatic dispatch allowance is spent until the user speaks again. Tell the user what you would send next.";
  }

  return `This is an automatic turn. You may dispatch ${autonomousRemaining} more time(s) before the user speaks again — only when the next step is clear from what the user already asked for.`;
}

/**
 * System fragment for orchestrator-authored dispatch (COA-258): the orchestrator's role, how to
 * write a brief, its autonomy bounds, and the roster it can direct.
 */
export function formatOrchestratorFragment(args: {
  snapshots: ReadonlyArray<SubagentThreadSnapshot>;
  autonomous: boolean;
  /** Automatic dispatches left; null when the worktable (which counts them) is unavailable. */
  autonomousRemaining: number | null;
}): string {
  const byAgent = new Map(args.snapshots.map((s) => [s.agentId, s]));
  const slots = createDemoSubagents();
  const slotIds = new Set(slots.map((s) => s.id));
  const roster = [
    ...slots.map(
      (s) =>
        `- ${s.name} (${s.role}, agentId=${s.id}) — ${byAgent.get(s.id)?.status ?? "idle"}. ${s.blurb}`
    ),
    ...args.snapshots
      .filter((s) => !slotIds.has(s.agentId))
      .map((s) => `- ${s.name} (${s.role}, agentId=${s.agentId}) — ${s.status}`),
  ];

  return [
    "[Orchestrator]",
    "You orchestrate Arcadia's subagents. Nothing reaches a subagent unless you send it with dispatch_subagent; each sees only its own thread — never this conversation or the other subagents' threads.",
    "- Answer quick conversational beats yourself. Delegate research, building, writing, planning, and review that takes real work.",
    "- Write each brief in your own words so it stands alone: the actual task (not the user's message pasted), why it matters, constraints, the deliverable, and when it is done.",
    "- Attach what the subagent needs: the user's exact words where they matter (user_message), other subagents' results (subagent_output), relevant memories (memory), and your own notes.",
    "- Keep reusable context on your worktable. Build a bundle once — for example a reviewer's rubric plus a live_subagent_output slot for the coder's latest work — then send it again, updating single items instead of rebuilding.",
    `- ${autonomyLine(args.autonomous, args.autonomousRemaining)}`,
    "- After dispatching, tell the user briefly who is doing what. Do not do delegated work inline.",
    "Roster:",
    ...roster,
  ].join("\n");
}
