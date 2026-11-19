/**
 * Right padding a draft needs so typed text wraps before the corner budget badge while the draft
 * count shows. Sized for the widest label `formatTokenCount` gives below 1M ("9,999 tok", 54px at
 * 10px mono) plus the ring, gap, button padding, and corner offset (~86px), with a little air.
 *
 * Only the full layout has the corner badge; the compact row keeps it in the settings panel and
 * must not reserve this room (see components/chat/core-input/compact-row.ts).
 */
export const CONTEXT_BUDGET_DRAFT_RESERVE_CLASS = "pr-[5.75rem]";
