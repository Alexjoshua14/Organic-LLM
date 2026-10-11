export type AgentDotState = "idle" | "working" | "waiting" | "blocked" | "complete";

// Five columns, six rows; empty cells never create hidden dots.
const ROW_COLUMNS = [[2], [1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4], [1, 2, 3], [2]];

export const AGENT_DOTS = ROW_COLUMNS.flatMap((columns, row) =>
  columns.map((column) => ({ x: 8 + column * 6, y: 5 + row * 6 }))
);

const BASE_OPACITY = 0.75;
const MAX_VARIANCE = 0.35;
const KEYFRAME_COUNT = 8;
const IDLE_DURATION_MS = [12_000, 20_000] as const;
const WORKING_DURATION_MS = [4_800, 7_200] as const;
const WAITING_DURATION_MS = 5_000;
const BLOCKED_DURATION_MS = 3_600;
const COMPLETE_DURATION_MS = 400;
const COMPLETE_STAGGER_MS = 20;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const EDGE_SCALE = 0.84;
const CENTER_SIZE_BIAS = 0.26;
const INITIAL_NOISE = 0.065;

/** Stable soft noise per identity: SSR and hydration start with the same dot sizes. */
export function dotRestScale(index: number, seed: string): number {
  let hash = 2166136261;

  for (const character of `${seed}:${index}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  const noise = ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
  const dot = AGENT_DOTS[index]!;
  const centerWeight = Math.max(0, 1 - Math.hypot(dot.x - 20, dot.y - 20) / 15);

  return EDGE_SCALE + CENTER_SIZE_BIAS * centerWeight + (noise * 2 - 1) * INITIAL_NOISE;
}

/** One size signal drives both radius and opacity: scale 1 is always opacity .75. */
export function dotOpacity(scale: number): number {
  const variance = Math.max(-1, Math.min(1, (scale - 1) / MAX_VARIANCE));

  return BASE_OPACITY + variance * (variance < 0 ? 0.35 : 0.2);
}

function frame(scale: number): Keyframe {
  return { transform: `scale(${scale})`, opacity: dotOpacity(scale), easing: EASING };
}

/** Called after mount only: randomness cannot change server-rendered markup. */
export function createDotAnimation(
  state: AgentDotState,
  index: number,
  start: Keyframe,
  restScale = 1,
  random: () => number = Math.random
): { frames: Keyframe[]; options: KeyframeAnimationOptions } {
  let scales: number[];
  let duration: number;

  switch (state) {
    case "working":
    case "idle": {
      const [min, max] = state === "idle" ? [0.05, 0.15] : [0.2, MAX_VARIANCE];
      const [fast, slow] = state === "idle" ? IDLE_DURATION_MS : WORKING_DURATION_MS;
      const direction = random() < 0.5 ? -1 : 1;

      scales = Array.from(
        { length: KEYFRAME_COUNT },
        (_, step) =>
          restScale * (1 + direction * (step % 2 ? -1 : 1) * (min + random() * (max - min)))
      );
      duration = fast + random() * (slow - fast);
      break;
    }
    case "waiting":
      scales = [1.07, 0.93, 1].map((scale) => restScale * scale);
      duration = WAITING_DURATION_MS;
      break;
    case "blocked":
      scales = (index % 2 ? [1, 1, 0.82, 1.18, 1] : [0.82, 1.18, 1, 1, 1]).map(
        (scale) => restScale * scale
      );
      duration = BLOCKED_DURATION_MS;
      break;
    case "complete":
      scales = [1.28 * restScale, restScale];
      duration = COMPLETE_DURATION_MS;
      break;
  }

  const dot = AGENT_DOTS[index]!;
  const distance = Math.hypot(dot.x - 20, dot.y - 20) / 6;

  scales = scales.map((scale) => Math.max(1 - MAX_VARIANCE, Math.min(1 + MAX_VARIANCE, scale)));
  // Keep interpolation on one side of the piecewise opacity curve at a time.
  const sizes = [restScale, ...scales, restScale];
  const targets = sizes.flatMap((scale, step) => [
    frame(scale),
    ...((scale - 1) * ((sizes[step + 1] ?? 1) - 1) < 0 ? [frame(1)] : []),
  ]);
  const crossesBaseline =
    (Number(start.opacity) - BASE_OPACITY) * (dotOpacity(restScale) - BASE_OPACITY) < 0;

  return {
    frames: [{ ...start, easing: EASING }, ...(crossesBaseline ? [frame(1)] : []), ...targets],
    options: {
      duration,
      iterations: 1,
      delay: state === "complete" ? distance * COMPLETE_STAGGER_MS : 0,
      fill: "both",
    },
  };
}
