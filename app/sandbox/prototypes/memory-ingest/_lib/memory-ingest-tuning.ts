import type { ParticleFieldVisualState } from "./types";

/**
 * Memory-ingest "feel" constants — the knobs you reach for when tuning the chamber on
 * :3003, gathered in one place. Values, not meaning: changing a number here adjusts the
 * feel without touching logic. Grouped by the system each one tunes.
 */

/* ── Particle field: transient pulse envelopes ────────────────────────────── */

/** Per-tick decay for the writing-memory glow pulse. */
export const PULSE_GLOW_DECAY = 0.9;
/** Per-tick decay for the receipt inhale pulse (punchier — ~0.8s to settle). */
export const PULSE_INHALE_DECAY = 0.88;
/** Cadence of the pulse decay timer (ms). */
export const PULSE_DECAY_INTERVAL_MS = 32;
/** Below this a pulse counts as settled: decay timer stops and the anchor solve is skipped. */
export const PULSE_EPSILON = 0.001;

/* ── Particle field: geometry / shader ────────────────────────────────────── */

/** Sprite-size multiplier applied to the per-device-tier base point size. */
export const POINT_SIZE_MULTIPLIER = 30;

/** Peak fraction the cloud gathers toward the composer anchor at full inhale. */
export const MAX_INHALE_PULL = 0.22;

/* ── Session timing ───────────────────────────────────────────────────────── */

/** How long the writing-memory beat lingers after FINISH before settling to idle (ms). */
export const RECEIPT_LINGER_MS = 1200;

/* ── FSM: rest intensity per visual state ─────────────────────────────────── */

/**
 * Rest intensity (0–1) for each particle visual state, propagated to the uniform presets.
 * Intensity is a pure function of the visual state (the DEBUG_SET override aside), so the
 * reducer reads it from here rather than scattering literals across every transition.
 */
export const INGEST_INTENSITY: Record<ParticleFieldVisualState, number> = {
  idle_ready: 0.45,
  listening: 0.35,
  ingesting: 0.55,
  searching_memory: 0.6,
  reasoning: 0.75,
  web_search: 0.65,
  writing_memory: 0.9,
};
