import { describe, expect, test } from "bun:test";

import { voiceMinuteUnits } from "@/lib/speak/voice-minute-meter";

describe("voice daily minute meter", () => {
  test("30 minutes of half-minute heartbeats consumes 30 units, not 60", () => {
    let used = 0;
    let units = 0;

    for (let i = 0; i < 60; i++) {
      units += voiceMinuteUnits(used, 0.5);
      used += 0.5;
    }

    expect(units).toBe(30);
  });

  test("heartbeat cadence and a partial final interval do not add extra minutes", () => {
    let used = 0;
    let units = 0;

    for (const delta of [0.1, 0.4, 0.9, 0.05, 0.75, 0.1]) {
      units += voiceMinuteUnits(used, delta);
      used += delta;
    }

    expect(units).toBe(3);
    expect(voiceMinuteUnits(used, 0)).toBe(0);
  });
});
