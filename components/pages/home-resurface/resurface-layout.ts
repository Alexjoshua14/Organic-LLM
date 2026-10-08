/**
 * Size and motion for the homepage resurface row. The two-line title guarantee is arithmetic, so
 * the numbers are kept together here:
 *
 * - **Width** `clamp(14rem, 20vw, 20rem)`. At the 14rem floor the title column is 200px (224px
 *   less 12px padding each side) — about 30 characters a line at 14px, so two lines hold the
 *   52-character clamp in `lib/resurface/title.ts` with room for word wrap.
 * - **Height** `clamp(5.75rem, 10vh, 7.5rem)`. The floor is the content: two 20px title lines
 *   (40px) + 8px gap + a 20px footer + 24px padding = 92px. On a 700–800px laptop 10vh alone is
 *   70–80px, which would crush the footer into the title.
 * - **Title** `text-sm leading-5` with `line-clamp-2` as the last resort behind the server clamp.
 */
export const RESURFACE_CARD_WIDTH = "clamp(14rem, 20vw, 20rem)";

export const RESURFACE_CARD_HEIGHT = "clamp(5.75rem, 10vh, 7.5rem)";

/** The voice start's ribbon viewBox; drawn once, never animated. */
export const RESURFACE_RIBBON_WIDTH = 120;
export const RESURFACE_RIBBON_HEIGHT = 20;

/**
 * Cards arrive after first paint, so they settle in rather than pop. Brief, per the design
 * backbone: functional motion should not feel like waiting.
 */
export const RESURFACE_ENTER_S = 0.32;
export const RESURFACE_STAGGER_S = 0.05;
export const RESURFACE_ENTER_RISE_PX = 8;
export const RESURFACE_EASE = [0.22, 1, 0.36, 1] as const;
