import { describe, expect, test } from "bun:test";

import {
  deriveSpeakStageStatus,
  speakBudgetMeter,
  speakPrimaryAction,
  speakShortcutFor,
  type SpeakStageConnection,
} from "@/lib/speak/speak-stage-view";

const idle: SpeakStageConnection = {
  connected: false,
  connecting: false,
  paused: false,
  error: null,
  phase: "idle",
  muted: false,
};

describe("deriveSpeakStageStatus", () => {
  test("idle reads as ready", () => {
    expect(deriveSpeakStageStatus(idle)).toMatchObject({ kind: "ready", live: false });
  });

  test("an error while disconnected wins over paused and ready", () => {
    const status = deriveSpeakStageStatus({ ...idle, paused: true, error: "Mic blocked" });

    expect(status.kind).toBe("error");
    expect(status.detail).toBe("Mic blocked");
  });

  test("connecting is not live", () => {
    expect(deriveSpeakStageStatus({ ...idle, connecting: true })).toMatchObject({
      kind: "connecting",
      live: false,
    });
  });

  test("connected follows the phase", () => {
    const live = { ...idle, connected: true };

    expect(deriveSpeakStageStatus({ ...live, phase: "idle" }).kind).toBe("listening");
    expect(deriveSpeakStageStatus({ ...live, phase: "listening" }).kind).toBe("listening");
    expect(deriveSpeakStageStatus({ ...live, phase: "thinking" }).kind).toBe("thinking");
    expect(deriveSpeakStageStatus({ ...live, phase: "speaking" }).kind).toBe("speaking");
  });

  test("muted wins over the phase while live, and says the idle pause still applies", () => {
    const status = deriveSpeakStageStatus({
      ...idle,
      connected: true,
      muted: true,
      phase: "speaking",
    });

    expect(status.kind).toBe("muted");
    expect(status.live).toBe(true);
    expect(status.detail).toContain("pauses");
  });

  test("an error during a live call does not hide the call", () => {
    expect(deriveSpeakStageStatus({ ...idle, connected: true, error: "tool failed" }).kind).toBe(
      "listening"
    );
  });

  test("paused explains why", () => {
    const status = deriveSpeakStageStatus({ ...idle, paused: true });

    expect(status.kind).toBe("paused");
    expect(status.detail).toContain("silence");
  });
});

describe("speakPrimaryAction", () => {
  test("maps each connection state to one action", () => {
    expect(speakPrimaryAction(idle)).toBe("start");
    expect(speakPrimaryAction({ ...idle, paused: true })).toBe("resume");
    expect(speakPrimaryAction({ ...idle, connecting: true })).toBe("connecting");
    expect(speakPrimaryAction({ ...idle, connected: true })).toBe("end");
  });
});

describe("speakBudgetMeter", () => {
  const budget = {
    monthlyCostCapUsd: 20,
    monthlyCostUsedUsd: 2,
    monthlyCostRemainingUsd: 18,
    dailyMinutesCap: 30,
    dailyMinutesRemaining: 24,
    sessionMaxMinutes: 8,
    concurrentSessions: 1,
    activeSessions: 0,
  };

  test("is null before the first session reports a budget", () => {
    expect(speakBudgetMeter(null)).toBeNull();
  });

  test("reports minutes as a fraction of today's cap", () => {
    const meter = speakBudgetMeter(budget)!;

    expect(meter.level).toBe("ok");
    expect(meter.minutesFraction).toBeCloseTo(0.8);
    expect(meter.label).toBe("24m left today");
    expect(meter.description).toContain("$18.00");
    expect(meter.description).toContain("8 minutes per call");
  });

  test("warns on low minutes or high spend", () => {
    expect(speakBudgetMeter({ ...budget, dailyMinutesRemaining: 5 })!.level).toBe("warn");
    expect(
      speakBudgetMeter({ ...budget, monthlyCostUsedUsd: 16, monthlyCostRemainingUsd: 4 })!.level
    ).toBe("warn");
  });

  test("is exhausted when either allowance runs out", () => {
    expect(speakBudgetMeter({ ...budget, dailyMinutesRemaining: 0 })!.level).toBe("exhausted");
    expect(
      speakBudgetMeter({ ...budget, monthlyCostUsedUsd: 20, monthlyCostRemainingUsd: 0 })!.level
    ).toBe("exhausted");
  });

  test("never reports a fraction outside 0–1", () => {
    expect(speakBudgetMeter({ ...budget, dailyMinutesRemaining: 90 })!.minutesFraction).toBe(1);
    expect(speakBudgetMeter({ ...budget, dailyMinutesCap: 0 })!.minutesFraction).toBe(0);
  });
});

describe("speakShortcutFor", () => {
  const off = { connected: false, connecting: false };
  const on = { connected: true, connecting: false };

  test("Space starts when idle and mutes when live", () => {
    expect(speakShortcutFor({ key: " " }, off)).toBe("primary");
    expect(speakShortcutFor({ key: " " }, on)).toBe("toggle-mute");
  });

  test("Space does nothing while connecting or when a control has focus", () => {
    expect(speakShortcutFor({ key: " " }, { connected: false, connecting: true })).toBeNull();
    expect(speakShortcutFor({ key: " ", targetInteractive: true }, off)).toBeNull();
  });

  test("M mutes only while live", () => {
    expect(speakShortcutFor({ key: "m" }, on)).toBe("toggle-mute");
    expect(speakShortcutFor({ key: "M" }, on)).toBe("toggle-mute");
    expect(speakShortcutFor({ key: "m" }, off)).toBeNull();
  });

  test("T toggles the transcript", () => {
    expect(speakShortcutFor({ key: "t" }, off)).toBe("toggle-transcript");
  });

  test("no key ends a call", () => {
    for (const key of ["Escape", "Enter", "e", "q", "Backspace"]) {
      expect(speakShortcutFor({ key }, on)).toBeNull();
    }
  });

  test("ignores typing, modifiers and key repeat", () => {
    expect(speakShortcutFor({ key: "m", targetTag: "INPUT" }, on)).toBeNull();
    expect(speakShortcutFor({ key: "m", targetTag: "TEXTAREA" }, on)).toBeNull();
    expect(speakShortcutFor({ key: "m", targetEditable: true }, on)).toBeNull();
    expect(speakShortcutFor({ key: "m", metaKey: true }, on)).toBeNull();
    expect(speakShortcutFor({ key: "t", ctrlKey: true }, on)).toBeNull();
    expect(speakShortcutFor({ key: " ", repeat: true }, off)).toBeNull();
  });
});
