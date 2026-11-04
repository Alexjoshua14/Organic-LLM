import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { createSubagentActivitySeed } from "./activity-seed";

import { coderSubagent } from "@/lib/llm/subagents/hard-set/agents/coder";
import { plannerSubagent } from "@/lib/llm/subagents/hard-set/agents/planner";
import { researcherSubagent } from "@/lib/llm/subagents/hard-set/agents/researcher";
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
    name: researcherSubagent.name,
    role: researcherSubagent.role,
    blurb: researcherSubagent.blurb,
    goal: "Awaiting assignment.",
    progress: "Idle — no live run yet.",
    progressPct: 0,
    status: "idle",
  },
  {
    id: "agent-coder",
    name: coderSubagent.name,
    role: coderSubagent.role,
    blurb: coderSubagent.blurb,
    goal: "Awaiting assignment.",
    progress: "Idle — no live run yet.",
    progressPct: 0,
    status: "idle",
  },
  {
    id: "agent-planner",
    name: plannerSubagent.name,
    role: plannerSubagent.role,
    blurb: plannerSubagent.blurb,
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
    activitySeed: createSubagentActivitySeed(seed),
    voiceId: voices.get(seed.id)!,
    milestones: [],
  }));
}
