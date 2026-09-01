/** Outgoing character stagger interval (seconds). */
export const PROCESSING_TEXT_BURN_OUT_STAGGER_S = 0.025;

/** Incoming character stagger interval (seconds). */
export const PROCESSING_TEXT_BURN_IN_STAGGER_S = 0.03;

/** Delay before the first incoming character animates (seconds). */
export const PROCESSING_TEXT_BURN_IN_INITIAL_DELAY_S = 0.15;

/** Per-character animation duration (seconds). */
export const PROCESSING_TEXT_BURN_CHAR_DURATION_S = 0.08;

/** Incoming opacity settle duration (seconds). */
export const PROCESSING_TEXT_BURN_IN_OPACITY_DURATION_S = 0.25;

/** Color-burn wave per character (seconds); bright leading edge → ShinyText dim. */
export const PROCESSING_TEXT_BURN_IN_COLOR_DURATION_S = 0.2;

/** Sustain shimmer loop duration (seconds). Matches ShinyText default (`speed={5}`). */
export const PROCESSING_TEXT_BURN_SUSTAIN_SHIMMER_S = 5;

export function processingTextBurnIncomingDelay(sequenceIndex: number): number {
  return (
    PROCESSING_TEXT_BURN_IN_INITIAL_DELAY_S + sequenceIndex * PROCESSING_TEXT_BURN_IN_STAGGER_S
  );
}

export function processingTextBurnOutgoingDelay(sequenceIndex: number): number {
  return sequenceIndex * PROCESSING_TEXT_BURN_OUT_STAGGER_S;
}

/** Gap between outgoing and incoming character `n` animation starts (seconds). */
export function processingTextBurnCharGap(sequenceIndex: number): number {
  const gap =
    processingTextBurnIncomingDelay(sequenceIndex) -
    processingTextBurnOutgoingDelay(sequenceIndex);

  return sequenceIndex === 0 ? gap - PROCESSING_TEXT_BURN_CHAR_DURATION_S : gap;
}
