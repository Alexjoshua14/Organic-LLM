import type { FieldName, StateRecipe } from "./fieldLibrary";

export type MotionClockChannel = "base" | "turbulence" | "flow" | "shape";

export type MotionClockPhases = {
  base: number;
  turbulence: number;
  flow: number;
  shape: number;
};

export type MotionClockRates = MotionClockPhases;

const BASE_RATE_FLOOR = 0.55;
const TURBULENCE_RATE_FLOOR = 0.7;
const FLOW_RATE_FLOOR = 0.5;
const SHAPE_RATE_FLOOR = 0.35;

const BASE_RATE_TEMPO_GAIN = 1.35;
const TURBULENCE_RATE_TEMPO_GAIN = 1.9;
const FLOW_RATE_TEMPO_GAIN = 1.2;
const SHAPE_RATE_TEMPO_GAIN = 0.85;

const TURBULENCE_COHERENCE_DAMP = 0.28;
const FLOW_COHERENCE_GAIN = 0.22;
const SHAPE_ENERGY_GAIN = 0.25;

export const FIELD_CLOCK_CHANNELS: Record<FieldName, MotionClockChannel> = {
  roundedCubeSDF: "shape",
  sphereSDF: "shape",
  shellMask: "shape",
  axisElongation: "shape",
  breath: "base",
  curlNoise: "turbulence",
  radialPulse: "base",
  jitter: "turbulence",
  directionalDrift: "flow",
  latticeSnap: "shape",
  clusterAttract: "flow",
  streamlines: "flow",
  tendrilReach: "flow",
  absorption: "flow",
};

function modulatorScalar(recipe: StateRecipe, key: "tempo" | "coherence" | "energy"): number {
  const value = recipe.modulators[key];
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value[0] ?? 0;
  return 0;
}

/**
 * Derive channel rates from the active blended recipe.
 * Rates are in "phase units per second", consumed by fixed-step integration.
 */
export function computeMotionClockRates(recipe: StateRecipe): MotionClockRates {
  const tempo = Math.max(0, modulatorScalar(recipe, "tempo"));
  const coherence = Math.min(1, Math.max(0, modulatorScalar(recipe, "coherence")));
  const energy = Math.max(0, modulatorScalar(recipe, "energy"));

  const base = BASE_RATE_FLOOR + tempo * BASE_RATE_TEMPO_GAIN;
  const turbulence =
    (TURBULENCE_RATE_FLOOR + tempo * TURBULENCE_RATE_TEMPO_GAIN) * (1 - coherence * TURBULENCE_COHERENCE_DAMP);
  const flow = (FLOW_RATE_FLOOR + tempo * FLOW_RATE_TEMPO_GAIN) * (1 + coherence * FLOW_COHERENCE_GAIN);
  const shape = (SHAPE_RATE_FLOOR + tempo * SHAPE_RATE_TEMPO_GAIN) * (1 + energy * SHAPE_ENERGY_GAIN);

  return { base, turbulence, flow, shape };
}

export function integrateMotionClockPhases(
  phases: MotionClockPhases,
  rates: MotionClockRates,
  dtSeconds: number
): MotionClockPhases {
  return {
    base: phases.base + rates.base * dtSeconds,
    turbulence: phases.turbulence + rates.turbulence * dtSeconds,
    flow: phases.flow + rates.flow * dtSeconds,
    shape: phases.shape + rates.shape * dtSeconds,
  };
}
