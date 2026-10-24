/** Visual vocabulary for the memory-ingest particle field (v1). */
export type ParticleFieldVisualState =
  | "idle_ready"
  | "listening"
  | "ingesting"
  | "searching_memory"
  | "reasoning"
  | "web_search"
  | "writing_memory";

/** Ordered list for dev tools and selectors. */
export const PARTICLE_FIELD_VISUAL_STATES: ParticleFieldVisualState[] = [
  "idle_ready",
  "listening",
  "ingesting",
  "searching_memory",
  "reasoning",
  "web_search",
  "writing_memory",
];

export type IngestModelTier = "reflex" | "reasoning";

export type MemoryIngestFsmState = {
  visual: ParticleFieldVisualState;
  /** 0–1, propagated to uniform presets */
  intensity: number;
  /** Last tier chosen for the outgoing request (for tool/generic mapping). */
  lastTier: IngestModelTier;
};
