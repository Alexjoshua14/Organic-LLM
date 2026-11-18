import { CONTEXT_BUDGET_DRAFT_RESERVE_CLASS } from "@/components/chat/context-budget-reserve";
import { cn } from "@/lib/utils";

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

/**
 * The draft's classes. The full layout reserves room on the right for the corner budget badge
 * while the draft count shows. The compact row shows the budget inside the settings panel, so
 * its draft takes the whole width: reserving the badge's room there halved a phone's text area,
 * made drafts stack early and stopped them ever returning to one line.
 */
export function composerDraftClassName({
  condensed,
  reserveBudget,
}: {
  condensed: boolean;
  reserveBudget: boolean;
}) {
  return cn(
    "text-base md:text-sm",
    !condensed && reserveBudget && CONTEXT_BUDGET_DRAFT_RESERVE_CLASS
  );
}
