/**
 * Entrance choreography for measure spans.
 * Stagger stays short so a full 12-row block finishes within ~700ms (Carbon-ish budget).
 */
export const MEASURE_SPAN_SPRING = {
  type: "spring" as const,
  stiffness: 140,
  damping: 22,
};

/** Instant land when prefers-reduced-motion is on. */
export const MEASURE_SPAN_REDUCED = { duration: 0 } as const;

/** Seconds between successive row span entrances. */
export const MEASURE_ROW_STAGGER_S = 0.06;
