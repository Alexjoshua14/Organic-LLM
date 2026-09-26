/**
 * Glass primitive lab layout — breakpoints next to the page chrome.
 * Tailwind fragments below must stay in sync with the px constants.
 */

/**
 * Min viewport width for the three-column material comparison.
 * Encoded in classes as Tailwind `lg` (1024px).
 */
export const GLASS_PRIMITIVE_COMPARE_MIN_WIDTH_PX = 1024;

/**
 * Below this height, hide the long page blurb so heroes stay on-screen
 * (short phone landscape). Encoded as `@max-h-[500px]:`.
 */
export const GLASS_PRIMITIVE_SHORT_VIEWPORT_MAX_HEIGHT_PX = 500;

export const glassPrimitiveChrome = {
  /** Page shell: vertical scroll on short viewports; never horizontal page scroll. */
  page: "relative z-10 h-full w-full min-w-0 overflow-x-clip overflow-y-auto",
  /** Inner measure — wide desktop stage, readable padding on phones. */
  inner:
    "mx-auto flex w-full max-w-[90rem] min-w-0 flex-col px-4 pb-10 pt-5 sm:px-8 sm:pb-14 sm:pt-8",
  /** Long intro — hide on short landscape so the first glass heroes remain visible. */
  headerBlurb: "@max-h-[500px]:hidden",
  /**
   * Material comparison: stack on phones / tablets; three columns from `lg`
   * (`GLASS_PRIMITIVE_COMPARE_MIN_WIDTH_PX`).
   */
  compareGrid:
    "grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-white/10",
  column: "min-w-0 overflow-x-clip px-0 lg:px-6 xl:px-8",
  columnFirst: "min-w-0 overflow-x-clip px-0 lg:pr-6 lg:pl-0 xl:pr-8",
  columnLast: "min-w-0 overflow-x-clip px-0 lg:pl-6 lg:pr-0 xl:pl-8",
} as const;
