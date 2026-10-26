import { describe, expect, test } from "bun:test";

import {
  activityGlassForState,
  getActivityMarkGlassProfile,
} from "@/components/chat/activity-mark-glass";
import { DotMorphPhysics } from "@/components/agents/dot-morph-physics";
import { dotRestScale } from "@/components/agents/agent-dot-grid-motion";
import {
  computeLlmProcessingIntensity,
  deriveSessionTelemetryCounts,
  MOTION_SCALE_MAX,
  MOTION_SCALE_MIN,
} from "@/lib/usage/processing-intensity";

describe("computeLlmProcessingIntensity", () => {
  test("returns idle tier, idle markState, and baseline motionScale when no activity is running", () => {
    const snapshot = computeLlmProcessingIntensity({
      isStreaming: false,
      activeSubagentCount: 0,
      completedSubagentCount: 0,
      toolCallCount: 0,
      estimatedTokensUsed: 0,
      planSpentUsd: 1.2,
      planLimitUsd: 10,
    });

    expect(snapshot.tier).toBe("idle");
    expect(snapshot.markState).toBe("idle");
    expect(snapshot.intensity).toBeGreaterThanOrEqual(0);
    expect(snapshot.intensity).toBeLessThanOrEqual(0.16);
    expect(snapshot.motionScale).toBeGreaterThanOrEqual(MOTION_SCALE_MIN);
    expect(snapshot.motionScale).toBeLessThan(1.05);
    expect(snapshot.budgetUtilizationRatio).toBeCloseTo(0.12, 3);
    expect(snapshot.budgetRemainingUsd).toBeCloseTo(8.8, 3);
    expect(snapshot.label).toBe("Idle · 12% budget");
  });

  test("maps completed subagents when idle to complete markState", () => {
    const snapshot = computeLlmProcessingIntensity({
      isStreaming: false,
      activeSubagentCount: 0,
      completedSubagentCount: 2,
      planSpentUsd: 2.5,
      planLimitUsd: 10,
    });

    expect(snapshot.tier).toBe("idle");
    expect(snapshot.markState).toBe("complete");
    expect(snapshot.label).toContain("Mesh ×2 complete");
  });

  test("computes light/working intensity for a single streaming turn", () => {
    const lightTurn = computeLlmProcessingIntensity({
      isStreaming: true,
      activeSubagentCount: 0,
      toolCallCount: 1,
      estimatedTokensUsed: 900,
    });

    expect(lightTurn.tier).toBe("light");
    expect(lightTurn.markState).toBe("working");
    expect(lightTurn.intensity).toBeGreaterThan(0.2);
    expect(lightTurn.intensity).toBeLessThan(0.42);
    expect(lightTurn.motionScale).toBeGreaterThan(MOTION_SCALE_MIN);
    expect(lightTurn.label).toContain("Streaming");
    expect(lightTurn.label).toContain("1 tool");
  });

  test("scales into intense tier when parallel subagent mesh and tools are active", () => {
    const singleWorker = computeLlmProcessingIntensity({
      isStreaming: true,
      activeSubagentCount: 1,
      toolCallCount: 2,
      estimatedTokensUsed: 2_400,
    });
    const parallelMesh = computeLlmProcessingIntensity({
      isStreaming: true,
      activeSubagentCount: 3,
      toolCallCount: 4,
      estimatedTokensUsed: 6_200,
    });

    expect(singleWorker.tier).toBe("working");
    expect(parallelMesh.tier).toBe("intense");
    expect(parallelMesh.markState).toBe("working");
    expect(parallelMesh.intensity).toBeGreaterThan(singleWorker.intensity);
    expect(parallelMesh.intensity).toBeGreaterThanOrEqual(0.72);
    expect(parallelMesh.motionScale).toBeGreaterThan(singleWorker.motionScale);
    expect(parallelMesh.motionScale).toBeLessThanOrEqual(MOTION_SCALE_MAX);
    expect(parallelMesh.label).toBe("Mesh ×3 working · 4 tools · 6.2k tok");
  });

  test("elevates intensity under high token burn against tokenSoftCap", () => {
    const lowTokens = computeLlmProcessingIntensity({
      isStreaming: true,
      activeSubagentCount: 1,
      toolCallCount: 2,
      estimatedTokensUsed: 1_200,
      tokenSoftCap: 24_000,
    });
    const highTokenBurn = computeLlmProcessingIntensity({
      isStreaming: true,
      activeSubagentCount: 2,
      toolCallCount: 5,
      estimatedTokensUsed: 23_500,
      tokenSoftCap: 24_000,
    });

    expect(highTokenBurn.intensity).toBeGreaterThan(lowTokens.intensity);
    expect(highTokenBurn.tier).toBe("intense");
    expect(highTokenBurn.label).toContain("23.5k tok");
  });

  test("transitions to limit-near tier near budget ceiling and blocked markState when exhausted", () => {
    const nearCeiling = computeLlmProcessingIntensity({
      isStreaming: true,
      activeSubagentCount: 0,
      toolCallCount: 1,
      planSpentUsd: 8.4,
      planLimitUsd: 10,
    });

    expect(nearCeiling.tier).toBe("limit-near");
    expect(nearCeiling.markState).toBe("working");
    expect(nearCeiling.budgetUtilizationRatio).toBeCloseTo(0.84, 3);
    expect(nearCeiling.budgetRemainingUsd).toBeCloseTo(1.6, 3);
    expect(nearCeiling.label).toBe("High load · 84% plan limit");

    const exhausted = computeLlmProcessingIntensity({
      isStreaming: false,
      activeSubagentCount: 0,
      planSpentUsd: 10,
      planLimitUsd: 10,
    });

    expect(exhausted.tier).toBe("limit-near");
    expect(exhausted.markState).toBe("blocked");
    expect(exhausted.budgetRemainingUsd).toBe(0);
    expect(exhausted.label).toContain("100% plan limit");
  });

  test("derives session telemetry counts from messages and subagent rows", () => {
    const counts = deriveSessionTelemetryCounts({
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Compare distributed consensus protocols" }],
        },
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "tool-dispatch_subagent",
              toolCallId: "tc-1",
              state: "output-available",
              input: { brief: "Investigate Raft vs Paxos" },
              output: { success: true, agentId: "subagent-researcher", goalId: "g-1" },
            } as never,
            { type: "text", text: "Dispatched Lyra to gather primary literature." },
          ],
        },
      ],
      subagents: [
        { status: "working", goal: "Investigate Raft vs Paxos" },
        { status: "queued", goal: "Draft architecture trade-offs" },
        { status: "done", goal: "Check implementation slice", outcome: "Completed slice" },
      ],
    });

    expect(counts.toolCallCount).toBe(1);
    expect(counts.activeSubagentCount).toBe(2);
    expect(counts.completedSubagentCount).toBe(1);
    expect(counts.estimatedTokensUsed).toBeGreaterThan(900);
  });
});

describe("intensity-modulated glass profile and dot physics", () => {
  test("preserves exact baseline glass profile when intensity is omitted", () => {
    expect(activityGlassForState("idle")).toEqual({
      opacity: 0.5,
      blur: 4.25,
      brightness: 1.15,
      tint: "var(--background)",
    });
    expect(activityGlassForState("working")).toEqual({
      opacity: 0.28,
      blur: 0.5,
      brightness: 1.75,
      tint: "color-mix(in oklch, var(--background) 92%, var(--accent))",
    });
  });

  test("smoothly modulates brightness, saturation, blur, and motionScale across intensity 0..1", () => {
    const low = getActivityMarkGlassProfile("working", 0.15);
    const high = getActivityMarkGlassProfile("working", 0.9);

    expect(high.brightness).toBeGreaterThan(low.brightness);
    expect(high.saturation).toBeGreaterThan(low.saturation);
    expect(high.blur).toBeGreaterThan(low.blur);
    expect(high.opacity).toBeLessThan(low.opacity);
    expect(high.motionScale).toBeGreaterThan(low.motionScale);

    // Bounds check even for out-of-range inputs
    const clampedHigh = getActivityMarkGlassProfile("working", 5);
    expect(clampedHigh.brightness).toBeLessThanOrEqual(2);
    expect(clampedHigh.blur).toBeLessThanOrEqual(14);
    expect(clampedHigh.opacity).toBeGreaterThanOrEqual(0);
    expect(clampedHigh.motionScale).toBeCloseTo(1.85, 3);
  });

  test("scales DotMorphPhysics cadence and keeps poses bounded under high intensity", () => {
    const rest = dotRestScale(0, "Lyra");
    const dotLow = new DotMorphPhysics(rest, 0, () => 0.8);
    const dotHigh = new DotMorphPhysics(rest, 0, () => 0.8);

    dotLow.setState("working");
    dotLow.setIntensity(0.1);

    dotHigh.setState("working");
    dotHigh.setIntensity(0.95);

    for (let frame = 0; frame < 60; frame++) {
      const poseLow = dotLow.step(1000 / 60);
      const poseHigh = dotHigh.step(1000 / 60);

      expect(poseLow.scale).toBeGreaterThanOrEqual(0.65);
      expect(poseLow.scale).toBeLessThanOrEqual(1.35);
      expect(poseHigh.scale).toBeGreaterThanOrEqual(0.65);
      expect(poseHigh.scale).toBeLessThanOrEqual(1.35);
      expect(Math.abs(poseHigh.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(poseHigh.y)).toBeLessThanOrEqual(0.5);
    }

    expect(dotHigh.current).not.toEqual(dotLow.current);
  });
});
