import { describe, expect, test } from "bun:test";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import {
  ARCADIA_MULTITASK_DEMO_TICK_MS,
  createArcadiaMultitaskDemo,
  tickArcadiaMultitaskDemo,
} from "@/lib/showcase/arcadia-multitask-demo";

describe("Arcadia multitask showcase replay", () => {
  test("advancing the demo preserves its initial state and the live idle roster", () => {
    const liveRoster = createDemoSubagents();
    const initial = createArcadiaMultitaskDemo();
    const initialSnapshot = structuredClone(initial);
    const next = tickArcadiaMultitaskDemo(initial, ARCADIA_MULTITASK_DEMO_TICK_MS);

    expect(initial).toEqual(initialSnapshot);
    expect(next.tick).toBe(1);
    expect(next.agents.find((a) => a.id === "agent-researcher")?.progressPct).toBe(48);
    expect(next.agents.find((a) => a.id === "agent-writer")?.status).toBe("working");
    expect(createDemoSubagents()).toEqual(liveRoster);
    expect(liveRoster.every((a) => a.status === "idle" && a.progressPct === 0)).toBe(true);
  });

  test("independent playback and reset produce deterministic milestones", () => {
    const first = tickArcadiaMultitaskDemo(createArcadiaMultitaskDemo(), 9_000);
    const second = tickArcadiaMultitaskDemo(first, 18_000);
    const planner = first.agents.find((a) => a.id === "agent-planner");

    expect(planner?.milestones[0]?.at).toBe(9_000);
    expect(second.agents.find((a) => a.id === "agent-researcher")?.milestones[0]?.at).toBe(18_000);
    expect(tickArcadiaMultitaskDemo(createArcadiaMultitaskDemo(), 9_000)).toEqual(first);
    expect(tickArcadiaMultitaskDemo(first, 18_000)).toEqual(second);
    expect(createArcadiaMultitaskDemo().agents.every((a) => a.milestones.length === 0)).toBe(true);
  });

  test("completed scripts stop advancing and do not duplicate milestones", () => {
    let state = createArcadiaMultitaskDemo();

    for (let tick = 1; tick <= 3; tick += 1) {
      state = tickArcadiaMultitaskDemo(state, tick * ARCADIA_MULTITASK_DEMO_TICK_MS);
    }

    expect(state.agents.map((a) => a.progressPct)).toEqual([90, 95, 92, 82, 70]);
    expect(state.agents.every((a) => a.milestones.length === 1)).toBe(true);
    expect(tickArcadiaMultitaskDemo(state, 36_000)).toBe(state);
  });
});
