import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

import {
  stashServerPhases,
  takeServerPhases,
  timeServerPhase,
} from "@/lib/perf/server-phase";

describe("perf server phase", () => {
  beforeEach(() => {
    // Clear stash between tests
    takeServerPhases("__clear__");
  });

  afterEach(() => {
    takeServerPhases("__clear__");
  });

  test("timeServerPhase records duration and returns result", async () => {
    const phases: Array<{ name: string; ms: number }> = [];
    const result = await timeServerPhase(phases, "createChat", async () => {
      await new Promise((r) => setTimeout(r, 5));

      return "thread-id";
    });

    expect(result).toBe("thread-id");
    expect(phases).toHaveLength(1);
    expect(phases[0]?.name).toBe("createChat");
    expect(phases[0]?.ms).toBeGreaterThanOrEqual(0);
  });

  test("timeServerPhase records duration when fn throws", async () => {
    const phases: Array<{ name: string; ms: number }> = [];

    await expect(
      timeServerPhase(phases, "loadChat", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(phases).toHaveLength(1);
    expect(phases[0]?.name).toBe("loadChat");
  });

  test("stash and take are take-once", () => {
    stashServerPhases("abc", [{ name: "createChat", ms: 12 }]);

    expect(takeServerPhases("abc")).toEqual([{ name: "createChat", ms: 12 }]);
    expect(takeServerPhases("abc")).toEqual([]);
  });

  test("take returns empty for unknown key", () => {
    expect(takeServerPhases("missing")).toEqual([]);
  });
});
