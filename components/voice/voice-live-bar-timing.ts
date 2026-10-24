/**
 * Live voice bar — motion and shape constants.
 *
 * Per `docs/design/README.md` principle 4, timing lives next to the effect and the docs record
 * the *why*. Rationale for these values is in `docs/speak/decisions/` (live bar ADR).
 */

/** Bar height. `h-8` in Tailwind terms; kept numeric because the SVG needs it. */
export const VOICE_BAR_HEIGHT_PX = 32;

/**
 * Reveal: the bar starts fully hidden behind the composer and translates up into view.
 * Entrance settles (principle 2), exit clears faster.
 */
export const VOICE_BAR_ENTER_MS = 420;
export const VOICE_BAR_EXIT_MS = 220;
/** Organic LLM's standard settle curve, shared with the Speak stage transitions. */
export const VOICE_BAR_EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * FluidGlass fades in over the CSS fallback once its first frame is on screen, then the fallback
 * unmounts. Long enough to read as the material settling rather than a swap; short enough to
 * finish inside the bar's own entrance. Opacity only — `backdrop-filter` is never animated.
 */
export const VOICE_GLASS_FADE_MS = 320;

// ---------------------------------------------------------------------------
// Waveform
// ---------------------------------------------------------------------------

/**
 * Driver curves, in render order. Each is one real audio dimension; the curves drawn between
 * them are interpolations, not measurements.
 *
 * Order is load-bearing: interpolation runs between *adjacent* pairs, so Volume→Treble→Bass
 * means the ribbon reads as overall level blending into brightness blending into weight.
 */
export const VOICE_WAVE_DRIVERS = ["volume", "treble", "bass"] as const;
export type VoiceWaveDriver = (typeof VOICE_WAVE_DRIVERS)[number];

/**
 * Interpolated curves generated between each adjacent driver pair.
 *
 * This is the knob that produces the reference art's look: the ribbon is not a shape with an
 * outline, it is the moiré of many thin strokes packed between two wandering curves. Total
 * stroked paths = `drivers + (drivers - 1) * steps` = 3 + 2·8 = 19 at the default.
 */
export const VOICE_WAVE_INTERPOLATION_STEPS = 8;

/** Sample points per curve across the bar width. Higher reads smoother; costs string length. */
export const VOICE_WAVE_CONTROL_POINTS = 11;

/**
 * Swing is expressed as a fraction of *available headroom*, not of bar height.
 *
 * Headroom is computed from the outermost driver baselines and the edge padding, so these two
 * numbers cannot cause clipping no matter how the baselines are retuned. An earlier version set
 * amplitude as a fraction of height and lost ~6.8px off the top and ~6.2px off the bottom of a
 * 32px bar — the ribbon's peaks were shaved flat against the viewBox.
 *
 * `1` means a fully-driven curve just touches the padded edge.
 */
export const VOICE_WAVE_AMPLITUDE_USE = 0.94;

/** Idle wander so the ribbon breathes during silence rather than flatlining. */
export const VOICE_WAVE_IDLE_USE = 0.17;

/**
 * Kept clear at the top and bottom of the viewBox. Strokes are centred on the path, so at least
 * half a stroke is needed or the outermost curve is shaved; the rest is visual breathing room.
 */
export const VOICE_WAVE_EDGE_PADDING_PX = 0.8;

/**
 * Audio level smoothing per frame (exponential moving average, 0–1 = none–instant).
 * Raw band energy is jittery enough to strobe; this is the difference between "alive" and "noisy".
 */
export const VOICE_WAVE_LEVEL_SMOOTHING = 0.18;

/**
 * FFT size for the analyser. 64 gives 32 frequency bins — the smallest power of two that still
 * separates bass from treble usefully. Per-frame work is therefore a fixed 32-element read
 * regardless of how many curves are rendered.
 */
export const VOICE_WAVE_FFT_SIZE = 64;

/** Bin ranges over the 32 bins, as [startInclusive, endExclusive]. */
export const VOICE_WAVE_BASS_BINS: readonly [number, number] = [0, 5];
export const VOICE_WAVE_TREBLE_BINS: readonly [number, number] = [18, 32];

/** Per-driver drift speed (radians/second) so the curves never move in lockstep. */
export const VOICE_WAVE_DRIFT_SPEED: Record<VoiceWaveDriver, number> = {
  volume: 0.42,
  treble: 0.67,
  bass: 0.28,
};

/** Stroke opacity at a driver curve and at the midpoint between two, respectively. */
export const VOICE_WAVE_DRIVER_OPACITY = 0.92;
export const VOICE_WAVE_MID_OPACITY = 0.3;

export const VOICE_WAVE_STROKE_WIDTH = 0.6;

// ---------------------------------------------------------------------------
// Elapsed clock
// ---------------------------------------------------------------------------

/**
 * Spring for the seconds glow. Under-damped just enough to overshoot a hair on each tick, so the
 * light feels like it is being *fed* rather than dialled.
 */
export const VOICE_GLOW_SPRING = { stiffness: 120, damping: 18, mass: 1, precision: 0.001 };

/** Glow intensity at `:00` and at `:59`. Never fully dark — the session is still live. */
export const VOICE_GLOW_MIN = 0.08;
export const VOICE_GLOW_MAX = 1;

/**
 * Glow blur radius in px at full intensity. Scales with intensity so the light spreads as it
 * strengthens rather than only brightening.
 */
export const VOICE_GLOW_BLUR_MIN_PX = 2;
export const VOICE_GLOW_BLUR_MAX_PX = 9;
