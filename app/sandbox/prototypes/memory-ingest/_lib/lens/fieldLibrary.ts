import type { ParticleFieldVisualState } from "../types";

/**
 * GPU field weights (0..1) composed in the vertex shader.
 * Property-level docs here power hover/intellisense for recipe keys.
 */
export interface FieldWeights {
  /** Rest-shape bias toward the rounded cube cloud scaffold. */
  roundedCubeSDF?: number;
  /** Morph bias toward a sphere projection. */
  sphereSDF?: number;
  /** Bias toward a shell/surface-only projection. */
  shellMask?: number;
  /** Stretch/compress motion along a principal axis. */
  axisElongation?: number;
  /** Coherent low-frequency inhale/exhale displacement. */
  breath?: number;
  /** Turbulent curl-style flow perturbation. */
  curlNoise?: number;
  /** Radial pulse traveling through the particle cloud. */
  radialPulse?: number;
  /** Per-particle incoherent drift / scatter noise. */
  jitter?: number;
  /** Directional advection along a preferred vector. */
  directionalDrift?: number;
  /** Grid-like snapping force toward lattice points. */
  latticeSnap?: number;
  /** Attraction toward local particle clusters. */
  clusterAttract?: number;
  /** Flow-line guidance for streaking trajectories. */
  streamlines?: number;
  /** Tendril-like reach toward/away from anisotropy direction. */
  tendrilReach?: number;
  /** Inward sink/absorption pull toward the core. */
  absorption?: number;
}

export type FieldName = keyof FieldWeights;

export type ModulatorName = "tempo" | "coherence" | "energy" | "anisotropy";

export interface StateRecipe {
  fields: FieldWeights;
  /** Scalars or vec3 for `anisotropy` (direction / intake axis). */
  modulators: Partial<Record<ModulatorName, number | [number, number, number]>>;
}

/** Same vocabulary as ingest FSM / dev tools. */
export type StateName = ParticleFieldVisualState;

export const ALL_FIELD_NAMES: FieldName[] = [
  "roundedCubeSDF",
  "sphereSDF",
  "shellMask",
  "axisElongation",
  "breath",
  "curlNoise",
  "radialPulse",
  "jitter",
  "directionalDrift",
  "latticeSnap",
  "clusterAttract",
  "streamlines",
  "tendrilReach",
  "absorption",
];

export const ALL_MODULATOR_NAMES: ModulatorName[] = ["tempo", "coherence", "energy", "anisotropy"];
