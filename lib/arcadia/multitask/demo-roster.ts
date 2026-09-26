import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { assignDistinctVoices } from "@/lib/arcadia/multitask/voice-assignment";

/**
 * Fixture roster identities (Lyra, Reed, …) — worker *slots* the shell already renders.
 * Status / progress come from live runs via the awareness bus, not from a script.
 */
const DEMO_SEEDS: Array<
  Omit<ArcadiaSubagent, "voiceId" | "milestones" | "progressPct"> & {
    progressPct: number;
  }
> = [
  {
    id: "agent-researcher",
    name: "Lyra",
    role: "researcher",
    blurb: "Pulls sources and threads citations.",
    goal: "Awaiting assignment.",
    progress: "Idle — no live run yet.",
    progressPct: 0,
    status: "idle",
  },
  {
    id: "agent-coder",
    name: "Reed",
    role: "coder",
    blurb: "Implements the thin vertical slice.",
    goal: "Awaiting assignment.",
    progress: "Idle — no live run yet.",
    progressPct: 0,
    status: "idle",
  },
  {
    id: "agent-planner",
    name: "Mira",
    role: "planner",
    blurb: "Keeps the board honest about scope.",
    goal: "Awaiting assignment.",
    progress: "Idle — no live run yet.",
    progressPct: 0,
    status: "idle",
  },
  {
    id: "agent-writer",
    name: "Cass",
    role: "writer",
    blurb: "Turns decisions into public docs.",
    goal: "Awaiting assignment.",
    progress: "Idle — no live run yet.",
    progressPct: 0,
    status: "idle",
  },
  {
    id: "agent-critic",
    name: "Vesper",
    role: "critic",
    blurb: "Pressure-tests assumptions out loud.",
    goal: "Awaiting assignment.",
    progress: "Idle — no live run yet.",
    progressPct: 0,
    status: "idle",
  },
];

export function createDemoSubagents(): ArcadiaSubagent[] {
  const voices = assignDistinctVoices(DEMO_SEEDS.map((a) => ({ id: a.id, role: a.role })));

  return DEMO_SEEDS.map((seed) => ({
    ...seed,
    voiceId: voices.get(seed.id)!,
    milestones: [],
  }));
}

/**
 * Former scripted demo ticks — kept empty so the provider interval is a no-op.
 * Live progress comes from worker model runs via awareness events.
 */
export const DEMO_PROGRESS_SCRIPT: Record<
  string,
  Array<{
    progress: string;
    progressPct: number;
    milestone?: string;
    status?: ArcadiaSubagent["status"];
  }>
> = {};
