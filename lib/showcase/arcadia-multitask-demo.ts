import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";

/** Original demo cadence; a showcase controller owns playback and its clock. */
export const ARCADIA_MULTITASK_DEMO_TICK_MS = 9_000;

type DemoStep = {
  progress: string;
  progressPct: number;
  milestone?: string;
  status?: ArcadiaSubagent["status"];
};

type DemoScript = {
  initial: Pick<ArcadiaSubagent, "goal" | "progress" | "progressPct" | "status">;
  steps: DemoStep[];
};

/** Original sandbox scenario, preserved for offline showcase playback only. */
const DEMO_SCRIPT: Record<string, DemoScript> = {
  "agent-researcher": {
    initial: {
      goal: "Map the three strongest approaches to ambient multi-agent presence.",
      progress: "Skimmed two papers; drafting a comparison matrix.",
      progressPct: 28,
      status: "working",
    },
    steps: [
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
  },
  "agent-coder": {
    initial: {
      goal: "Ship a Speak-to path that seeds goal + progress into a new Realtime session.",
      progress: "Session mint accepts voice; wiring progress/milestone clients next.",
      progressPct: 45,
      status: "working",
    },
    steps: [
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
  },
  "agent-planner": {
    initial: {
      goal: "Break the multitask shell into shippable cuts without inventing a backend.",
      progress: "Cut list drafted; waiting on Speak event endpoint names.",
      progressPct: 62,
      status: "working",
    },
    steps: [
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
  },
  "agent-writer": {
    initial: {
      goal: "Document the shell, voice roster, and silent-vs-spoken Speak events.",
      progress: "Outline ready; ADR stub queued.",
      progressPct: 18,
      status: "idle",
    },
    steps: [
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
  },
  "agent-critic": {
    initial: {
      goal: "Flag any place the shell pretends a production swarm exists.",
      progress: "Reviewed roster honesty; no blockers yet.",
      progressPct: 40,
      status: "idle",
    },
    steps: [
      {
        progress: "Checked that demo ticks do not claim a live swarm API.",
        progressPct: 70,
        status: "working",
        milestone: "Honesty check passed — shell labeled as sandbox roster.",
      },
    ],
  },
};

export type ArcadiaMultitaskDemoState = {
  agents: ArcadiaSubagent[];
  tick: number;
};

export function createArcadiaMultitaskDemo(): ArcadiaMultitaskDemoState {
  return {
    agents: createDemoSubagents().map((agent) => ({
      ...agent,
      ...DEMO_SCRIPT[agent.id]?.initial,
    })),
    tick: 0,
  };
}

/** Pure replay step: no timers, API calls, Speak updates, or shared mutable cursor. */
export function tickArcadiaMultitaskDemo(
  state: ArcadiaMultitaskDemoState,
  at: number
): ArcadiaMultitaskDemoState {
  let changed = false;
  const agents = state.agents.map((agent) => {
    const step = DEMO_SCRIPT[agent.id]?.steps[state.tick];

    if (!step) return agent;
    changed = true;

    return {
      ...agent,
      progress: step.progress,
      progressPct: step.progressPct,
      status: step.status ?? agent.status,
      milestones: step.milestone
        ? [
            ...agent.milestones,
            { id: `showcase-${agent.id}-${state.tick + 1}`, label: step.milestone, at },
          ]
        : agent.milestones,
    };
  });

  return changed ? { agents, tick: state.tick + 1 } : state;
}
