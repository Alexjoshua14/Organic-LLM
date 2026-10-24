import { describe, expect, test } from "bun:test";

import { createDemoSubagents } from "@/lib/arcadia/multitask/demo-roster";
import { formatSubagentSessionContext, subagentToSpeakSeed } from "@/lib/arcadia/multitask/format-seed";
import {
  ARCADIA_ROLE_VOICE_PRESETS,
  assignDistinctVoices,
} from "@/lib/arcadia/multitask/voice-assignment";
import { SPEAK_REALTIME_VOICES } from "@/lib/schemas/speak-realtime-voice";

describe("assignDistinctVoices", () => {
  test("gives concurrent agents distinct voices while the pool has free ids", () => {
    const agents = [
      { id: "a", role: "researcher" },
      { id: "b", role: "coder" },
      { id: "c", role: "planner" },
      { id: "d", role: "writer" },
      { id: "e", role: "critic" },
    ];
    const map = assignDistinctVoices(agents);
    const voices = [...map.values()];

    expect(new Set(voices).size).toBe(voices.length);
    expect(map.get("a")).toBe(ARCADIA_ROLE_VOICE_PRESETS.researcher);
    expect(map.get("b")).toBe(ARCADIA_ROLE_VOICE_PRESETS.coder);
  });

  test("reassigns when two agents prefer the same preset and free voices remain", () => {
    const agents = [
      { id: "a", role: "researcher" },
      { id: "b", role: "researcher" },
    ];
    const map = assignDistinctVoices(agents);

    expect(map.get("a")).toBe(ARCADIA_ROLE_VOICE_PRESETS.researcher);
    expect(map.get("b")).not.toBe(map.get("a"));
    expect(SPEAK_REALTIME_VOICES).toContain(map.get("b")!);
  });

  test("cycles only after the voice pool is exhausted", () => {
    const agents = SPEAK_REALTIME_VOICES.map((role, i) => ({
      id: `id-${i}`,
      // Force every agent onto the same preferred voice so uniqueness drains the pool.
      role: "researcher",
    }));
    // One extra agent beyond the pool size.
    agents.push({ id: "overflow", role: "researcher" });

    const map = assignDistinctVoices(agents);
    const uniqueAmongFirst = new Set(
      SPEAK_REALTIME_VOICES.map((_, i) => map.get(`id-${i}`))
    );

    expect(uniqueAmongFirst.size).toBe(SPEAK_REALTIME_VOICES.length);
    expect(map.get("overflow")).toBeDefined();
  });
});

describe("demo roster + Speak seed", () => {
  test("demo subagents each carry a Realtime voice id", () => {
    const agents = createDemoSubagents();
    const voices = agents.map((a) => a.voiceId);

    expect(agents.length).toBeGreaterThanOrEqual(3);
    expect(new Set(voices).size).toBe(voices.length);

    for (const agent of agents) {
      expect(SPEAK_REALTIME_VOICES).toContain(agent.voiceId);
      const seed = subagentToSpeakSeed(agent);

      expect(seed.voice).toBe(agent.voiceId);
      expect(seed.goal).toBe(agent.goal);
      expect(seed.progress).toBe(agent.progress);

      const ctx = formatSubagentSessionContext(seed);

      expect(ctx).toContain(agent.name);
      expect(ctx).toContain(agent.goal);
      expect(ctx).toContain("Background progress updates");
      expect(ctx).toContain("milestone");
    }
  });
});
