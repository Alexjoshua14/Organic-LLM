import type { ArcadiaSubagent, ArcadiaSubagentStatus } from "@/lib/arcadia/multitask/types";

import { assignDistinctVoices } from "@/lib/arcadia/multitask/voice-assignment";

/** One subagent thread as served by `GET /api/chat/[id]/arcadia/subagents`. */
export type SubagentBoardEntry = {
  agentId: string;
  threadId: string;
  name: string;
  role: string;
  status: ArcadiaSubagentStatus;
  statusAt: string | null;
  goal: string | null;
  outcome: string | null;
};

export type SubagentBoardPayload = {
  orchestratorThreadId: string;
  subagents: SubagentBoardEntry[];
};

/**
 * Board poll cadence. Subagents run after the orchestrator's stream closes, so their progress
 * reaches the board by polling the child rows. Fast while something runs so completion shows
 * within a few seconds; slow otherwise. Polling pauses while the tab is hidden.
 */
export const SUBAGENT_BOARD_POLL_ACTIVE_MS = 4_000;
export const SUBAGENT_BOARD_POLL_IDLE_MS = 30_000;

const WORKING_PROGRESS = "Working in its own thread.";
const STALLED_PROGRESS = "Stalled — the last run did not finish.";

export function firstSentence(text: string, max = 140): string {
  const first = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text.trim();

  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

function mergeEntry(agent: ArcadiaSubagent, entry: SubagentBoardEntry, now: number): ArcadiaSubagent {
  const finishedNow = entry.status === "done" && agent.status !== "done" && Boolean(entry.outcome);
  const milestoneId = `ms-${entry.threadId}-${entry.statusAt ?? "na"}`;
  const milestones =
    finishedNow && !agent.milestones.some((m) => m.id === milestoneId)
      ? [
          ...agent.milestones,
          {
            id: milestoneId,
            label: firstSentence(entry.outcome!),
            at: (entry.statusAt ? Date.parse(entry.statusAt) : Number.NaN) || now,
          },
        ]
      : agent.milestones;

  const progress =
    entry.status === "working"
      ? WORKING_PROGRESS
      : entry.status === "blocked"
        ? (entry.outcome ?? STALLED_PROGRESS)
        : entry.status === "done"
          ? (entry.outcome ?? agent.progress)
          : agent.progress;

  const progressPct =
    entry.status === "done"
      ? 100
      : entry.status === "working"
        ? agent.status === "working"
          ? agent.progressPct
          : 0
        : agent.progressPct;

  const goal = entry.goal ?? agent.goal;

  if (
    agent.threadId === entry.threadId &&
    agent.status === entry.status &&
    agent.goal === goal &&
    agent.progress === progress &&
    agent.progressPct === progressPct &&
    agent.milestones === milestones
  ) {
    return agent;
  }

  return {
    ...agent,
    threadId: entry.threadId,
    status: entry.status,
    goal,
    progress,
    progressPct,
    milestones,
  };
}

/**
 * Fold server-side subagent threads onto the client roster. Roster slots keep their identity
 * and voice; threads for agents the roster lacks (router-spawned workers) are appended.
 */
export function mergeSubagentBoard(
  agents: ReadonlyArray<ArcadiaSubagent>,
  entries: ReadonlyArray<SubagentBoardEntry>,
  now: number = Date.now()
): ArcadiaSubagent[] {
  const byAgent = new Map(entries.map((e) => [e.agentId, e]));
  const merged = agents.map((agent) => {
    const entry = byAgent.get(agent.id);

    return entry ? mergeEntry(agent, entry, now) : agent;
  });

  const known = new Set(agents.map((a) => a.id));
  const extras = entries.filter((e) => !known.has(e.agentId));

  if (extras.length === 0) return merged;

  const voices = assignDistinctVoices([
    ...agents.map((a) => ({ id: a.id, role: a.role })),
    ...extras.map((e) => ({ id: e.agentId, role: e.role })),
  ]);

  return [
    ...merged,
    ...extras.map((entry) =>
      mergeEntry(
        {
          id: entry.agentId,
          name: entry.name,
          role: entry.role,
          blurb: "Spawned by the orchestrator for one thread of work.",
          goal: entry.goal ?? "Awaiting assignment.",
          progress: "Idle — no live run yet.",
          progressPct: 0,
          status: "idle",
          milestones: [],
          voiceId: voices.get(entry.agentId)!,
          threadId: entry.threadId,
        },
        entry,
        now
      )
    ),
  ];
}

export type BoardSpeakUpdate = { agentId: string; progress: string; milestone?: string };

/**
 * What a live Speak session should hear after a board refresh: a milestone when an agent just
 * finished, otherwise silent progress when its narrative changed.
 */
export function diffBoardForSpeak(
  prev: ReadonlyArray<ArcadiaSubagent>,
  next: ReadonlyArray<ArcadiaSubagent>
): BoardSpeakUpdate[] {
  const before = new Map(prev.map((a) => [a.id, a]));
  const updates: BoardSpeakUpdate[] = [];

  for (const agent of next) {
    const old = before.get(agent.id);

    if (!old) continue;

    if (agent.status === "done" && old.status !== "done") {
      updates.push({
        agentId: agent.id,
        progress: agent.progress,
        milestone: agent.milestones.at(-1)?.label,
      });
    } else if (agent.progress !== old.progress || agent.status !== old.status) {
      updates.push({ agentId: agent.id, progress: agent.progress });
    }
  }

  return updates;
}
