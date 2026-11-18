/**
 * Class names for the compact CoreInput row, shared by CoreInput and its browser regression
 * harness (tests/fixtures/composer-reflow-harness.tsx) so the two can never drift.
 */

/** A compact action group: one line of text tall (the send button), every control centred in it. */
export const COMPACT_ROW_BAND = "flex min-h-9 items-center gap-inline-xs pointer-coarse:min-h-11";

/** The draft on the one-line layout: the same band, its single line centred in it. */
export const COMPACT_ROW_LINE = "flex min-h-9 flex-col justify-center pointer-coarse:min-h-11";

/** The compact Send button (a Lumen chip): a 36px circle on a mouse, a 44px circle on touch. */
export const COMPACT_SUBMIT_CLASS = "core-input-compact-submit size-9 rounded-full";
