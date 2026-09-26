import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { assignDistinctVoices } from "@/lib/arcadia/multitask/voice-assignment";

/**
 * Sandbox roster — not a live orchestration backend.
 * Roles map to Realtime voices via {@link assignDistinctVoices} /
 * `ARCADIA_ROLE_VOICE_PRESETS`.
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
    goal: "Map the three strongest approaches to ambient multi-agent presence.",
    progress: "Skimmed two papers; drafting a comparison matrix.",
    progressPct: 28,
    status: "working",
  },
  {
    id: "agent-coder",
    name: "Reed",
    role: "coder",
    blurb: "Implements the thin vertical slice.",
    goal: "Ship a Speak-to path that seeds goal + progress into a new Realtime session.",
    progress: "Session mint accepts voice; wiring progress/milestone clients next.",
    progressPct: 45,
    status: "working",
  },
  {
    id: "agent-planner",
    name: "Mira",
    role: "planner",
    blurb: "Keeps the board honest about scope.",
    goal: "Break the multitask shell into shippable cuts without inventing a backend.",
    progress: "Cut list drafted; waiting on Speak event endpoint names.",
    progressPct: 62,
    status: "working",
  },
  {
    id: "agent-writer",
    name: "Cass",
    role: "writer",
    blurb: "Turns decisions into public docs.",
    goal: "Document the shell, voice roster, and silent-vs-spoken Speak events.",
    progress: "Outline ready; ADR stub queued.",
    progressPct: 18,
    status: "idle",
  },
  {
    id: "agent-critic",
    name: "Vesper",
    role: "critic",
    blurb: "Pressure-tests assumptions out loud.",
    goal: "Flag any place the shell pretends a production swarm exists.",
    progress: "Reviewed roster honesty; no blockers yet.",
    progressPct: 40,
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

/** Scripted demo ticks — progress narrative + optional milestone label. */
export const DEMO_PROGRESS_SCRIPT: Record<
  string,
  Array<{
    progress: string;
    progressPct: number;
    milestone?: string;
    status?: ArcadiaSubagent["status"];
  }>
> = {
  "agent-researcher": [
    {
      progress: "Comparison matrix half-filled; noting citation gaps.",
      progressPct: 48,
    },
    {
      progress: "Matrix complete; drafting takeaway bullets.",
      progressPct: 72,
      milestone: "Research matrix locked — three approaches compared.",
    },
    {
      progress: "Takeaways ready for the planner.",
      progressPct: 90,
      status: "working",
    },
  ],
  "agent-coder": [
    {
      progress: "Progress and milestone client helpers landed.",
      progressPct: 68,
    },
    {
      progress: "Speak-to seeds goal + progress; voice id passes through mint.",
      progressPct: 88,
      milestone: "Speak-to vertical slice compiles end to end.",
    },
    {
      progress: "Waiting on shell QA.",
      progressPct: 95,
      status: "working",
    },
  ],
  "agent-planner": [
    {
      progress: "Endpoint names confirmed: /progress vs /milestone.",
      progressPct: 78,
      milestone: "Cut list accepted — sandbox roster is the honest data source.",
    },
    {
      progress: "Tracking open questions in the hub protocol.",
      progressPct: 92,
      status: "working",
    },
  ],
  "agent-writer": [
    {
      progress: "Voice roster table drafted beside the shell.",
      progressPct: 55,
      status: "working",
    },
    {
      progress: "Operational docs updated for Arcadia multitask + Speak events.",
      progressPct: 82,
      milestone: "Docs pass: silent progress vs spoken milestones recorded.",
    },
  ],
  "agent-critic": [
    {
      progress: "Checked that demo ticks do not claim a live swarm API.",
      progressPct: 70,
      status: "working",
      milestone: "Honesty check passed — shell labeled as sandbox roster.",
    },
  ],
};
