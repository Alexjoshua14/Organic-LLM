/**
 * Timing for the persona Spark's states. Mirrored as CSS custom properties on the mark, so the
 * stylesheet reads these values rather than restating them.
 *
 * - Heard pulse 480ms: a receipt, so it starts on the same frame as the event (under the 250ms
 *   receipt budget in docs/design/motion-and-text-timing.md) and finishes inside NN/G's ~500ms
 *   functional band.
 * - Deciding breath 1.6s and speaking breath 1.1s: ambient loops, not feedback; slow enough to
 *   read as presence rather than a spinner.
 * - State fade 280ms in / 180ms out: Material short-enter, exits faster than entrances.
 */
export const SPARK_HEARD_PULSE_MS = 480;
export const SPARK_DECIDING_BREATH_MS = 1600;
export const SPARK_SPEAKING_BREATH_MS = 1100;
export const SPARK_STATE_ENTER_MS = 280;
export const SPARK_STATE_EXIT_MS = 180;

export const SPARK_TIMING_VARS = {
  "--persona-spark-pulse-ms": `${SPARK_HEARD_PULSE_MS}ms`,
  "--persona-spark-deciding-ms": `${SPARK_DECIDING_BREATH_MS}ms`,
  "--persona-spark-speaking-ms": `${SPARK_SPEAKING_BREATH_MS}ms`,
  "--persona-spark-enter-ms": `${SPARK_STATE_ENTER_MS}ms`,
  "--persona-spark-exit-ms": `${SPARK_STATE_EXIT_MS}ms`,
} as const;
