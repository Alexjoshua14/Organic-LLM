import type { MorphClock } from "@/lib/core-input/morph-timeline";

import { describe, expect, test } from "bun:test";

import { createMorphTimeline, morphStepOffsets } from "@/lib/core-input/morph-timeline";
import {
  CORE_INPUT_MORPH_FAST_FORWARD_RATE,
  CORE_INPUT_MORPH_FIRST_STEP_MS,
  CORE_INPUT_MORPH_MS,
  CORE_INPUT_MORPH_SETTLE_MS,
} from "@/lib/core-input/morph-timing";

/** Frames fire only when the test advances time. */
function fakeClock() {
  let now = 0;
  let pending: (() => void) | null = null;
  const clock: MorphClock = {
    now: () => now,
    requestFrame: (callback) => {
      pending = callback;

      return 1;
    },
    cancelFrame: () => {
      pending = null;
    },
  };

  return {
    clock,
    advance(ms: number, frameMs = 16) {
      for (let elapsed = 0; elapsed < ms; elapsed += frameMs) {
        now += frameMs;
        const frame = pending;

        pending = null;
        frame?.();
      }
    },
    now: () => now,
  };
}

function run(steps: string[]) {
  const time = fakeClock();
  const applied: Array<[string, number]> = [];
  let done = 0;
  const timeline = createMorphTimeline({
    steps,
    onStep: (step) => applied.push([step, time.now()]),
    onDone: () => {
      done += 1;
    },
    clock: time.clock,
  });

  return { time, applied, timeline, done: () => done };
}

describe("core input morph timeline", () => {
  test("offsets spread between the lead beat and the settle tail", () => {
    expect(morphStepOffsets(0)).toEqual([]);
    expect(morphStepOffsets(1)).toEqual([CORE_INPUT_MORPH_FIRST_STEP_MS]);
    const offsets = morphStepOffsets(4);

    expect(offsets[0]).toBe(CORE_INPUT_MORPH_FIRST_STEP_MS);
    expect(offsets.at(-1)).toBe(CORE_INPUT_MORPH_MS - CORE_INPUT_MORPH_SETTLE_MS);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  test("applies every step in order within the morph duration", () => {
    const { time, applied, timeline, done } = run(["modelId", "effort", "webSearch"]);

    time.advance(CORE_INPUT_MORPH_MS + 32);

    expect(applied.map(([step]) => step)).toEqual(["modelId", "effort", "webSearch"]);
    expect(applied.at(-1)![1]).toBeLessThanOrEqual(CORE_INPUT_MORPH_MS);
    expect(done()).toBe(1);
    expect(timeline.isRunning()).toBe(false);
  });

  test("speeding up compresses the remaining steps without skipping or reordering", () => {
    const { time, applied, timeline, done } = run(["modelId", "effort", "memories", "speechFriendly"]);

    time.advance(64);
    expect(applied.map(([step]) => step)).toEqual(["modelId"]);
    timeline.speedUp(CORE_INPUT_MORPH_FAST_FORWARD_RATE);
    const remainingMs = (CORE_INPUT_MORPH_MS - 64) / CORE_INPUT_MORPH_FAST_FORWARD_RATE;

    time.advance(remainingMs + 16);

    expect(applied.map(([step]) => step)).toEqual(["modelId", "effort", "memories", "speechFriendly"]);
    expect(time.now()).toBeLessThan(64 + CORE_INPUT_MORPH_MS / 2);
    expect(done()).toBe(1);
  });

  test("finish applies what is left synchronously, once", () => {
    const { applied, timeline, done } = run(["modelId", "effort"]);

    timeline.finish();
    timeline.finish();

    expect(applied.map(([step]) => step)).toEqual(["modelId", "effort"]);
    expect(done()).toBe(1);
  });

  test("cancel stops without applying the rest", () => {
    const { time, applied, timeline, done } = run(["modelId", "effort"]);

    timeline.cancel();
    time.advance(CORE_INPUT_MORPH_MS * 2);

    expect(applied).toEqual([]);
    expect(done()).toBe(0);
  });
});
