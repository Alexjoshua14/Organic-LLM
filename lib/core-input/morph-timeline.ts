import {
  CORE_INPUT_MORPH_FIRST_STEP_MS,
  CORE_INPUT_MORPH_MS,
  CORE_INPUT_MORPH_SETTLE_MS,
} from "./morph-timing";

export type MorphClock = {
  now: () => number;
  requestFrame: (callback: () => void) => unknown;
  cancelFrame: (handle: unknown) => void;
};

export type MorphTimeline = {
  /** Multiplies playback speed from now on. Steps keep their order; none are skipped. */
  speedUp: (rate: number) => void;
  /** Applies every remaining step synchronously and settles. Safe to call when done. */
  finish: () => void;
  /** Stops without applying remaining steps. */
  cancel: () => void;
  isRunning: () => boolean;
};

type MorphTimelineOptions<Step> = {
  steps: readonly Step[];
  durationMs?: number;
  onStep: (step: Step) => void;
  onProgress?: (progress: number) => void;
  onDone?: () => void;
  clock?: MorphClock;
};

/** When each of `count` steps fires: spread evenly between the lead beat and settle tail. */
export function morphStepOffsets(count: number, durationMs = CORE_INPUT_MORPH_MS): number[] {
  if (count <= 0) return [];
  const start = Math.min(CORE_INPUT_MORPH_FIRST_STEP_MS, durationMs);
  const end = Math.max(start, durationMs - CORE_INPUT_MORPH_SETTLE_MS);

  if (count === 1) return [start];

  return Array.from({ length: count }, (_, i) => start + ((end - start) * i) / (count - 1));
}

const browserClock: MorphClock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle as number),
};

/**
 * Plays `steps` across one morph. Elapsed time is integrated frame by frame and scaled by
 * the playback rate, so {@link MorphTimeline.speedUp} compresses only what is left.
 */
export function createMorphTimeline<Step>({
  steps,
  durationMs = CORE_INPUT_MORPH_MS,
  onStep,
  onProgress,
  onDone,
  clock = browserClock,
}: MorphTimelineOptions<Step>): MorphTimeline {
  const offsets = morphStepOffsets(steps.length, durationMs);
  let next = 0;
  let elapsed = 0;
  let rate = 1;
  let last = clock.now();
  let running = true;
  let frame: unknown = null;

  const applyThrough = (time: number) => {
    while (next < steps.length && offsets[next]! <= time) {
      onStep(steps[next]!);
      next += 1;
    }
  };

  const settle = () => {
    running = false;
    if (frame !== null) clock.cancelFrame(frame);
    frame = null;
    onProgress?.(1);
    onDone?.();
  };

  const tick = () => {
    frame = null;
    if (!running) return;
    const now = clock.now();

    elapsed += (now - last) * rate;
    last = now;
    applyThrough(elapsed);

    if (elapsed >= durationMs) {
      applyThrough(Number.POSITIVE_INFINITY);
      settle();

      return;
    }

    onProgress?.(elapsed / durationMs);
    frame = clock.requestFrame(tick);
  };

  onProgress?.(0);
  frame = clock.requestFrame(tick);

  return {
    speedUp(nextRate) {
      if (!running || nextRate <= rate) return;
      // Bank time at the old rate before switching, so the change applies from now on.
      const now = clock.now();

      elapsed += (now - last) * rate;
      last = now;
      rate = nextRate;
    },
    finish() {
      if (!running) return;
      applyThrough(Number.POSITIVE_INFINITY);
      settle();
    },
    cancel() {
      if (!running) return;
      running = false;
      if (frame !== null) clock.cancelFrame(frame);
      frame = null;
    },
    isRunning: () => running,
  };
}
