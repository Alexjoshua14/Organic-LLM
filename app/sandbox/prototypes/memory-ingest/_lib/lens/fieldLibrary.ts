import type { ParticleFieldVisualState } from "../types";

/** GPU field weights (0..1) composed in the vertex shader. */
export type FieldName =
  | "roundedCubeSDF"
  | "sphereSDF"
  | "shellMask"
  | "axisElongation"
  | "breath"
  | "curlNoise"
  | "radialPulse"
  | "jitter"
  | "directionalDrift"
  | "latticeSnap"
  | "clusterAttract"
  | "streamlines"
  | "tendrilReach"
  | "absorption";

export type ModulatorName = "tempo" | "coherence" | "energy" | "anisotropy";

export interface StateRecipe {
  fields: Partial<Record<FieldName, number>>;
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
