/**
 * Ergon `/ergon` page layout — when the header chrome and task column fit a phone.
 *
 * Desktop (`md+`) keeps the wide title + filter row. At or below this width the
 * title hides (controls stay), the column uses tighter inset, and horizontal
 * page scroll is clipped — the primary task list remains the scroll surface.
 *
 * Tailwind `max-[767px]:…` / `md:` (768) must stay in sync with
 * {@link ERGON_PAGE_NARROW_MAX_PX}. Short-height uses
 * `[@media(max-height:500px)]:…` in sync with {@link ERGON_PAGE_SHORT_MAX_PX}.
 */

/** Max CSS px for stacked / phone chrome (aligns with Tailwind `md` − 1). */
export const ERGON_PAGE_NARROW_MAX_PX = 767;

/** Short viewport (landscape phone ~390px tall). */
export const ERGON_PAGE_SHORT_MAX_PX = 500;

/**
 * Static Tailwind fragments for the Ergon page shell.
 * Narrow max must equal {@link ERGON_PAGE_NARROW_MAX_PX}.
 */
export const ergonPageLayout = {
  shell: "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden",
  /** Matches former PageContentFrame (5xl) task column width. */
  taskColumn: "mx-auto w-full min-w-0 max-w-5xl px-4 sm:px-6 max-[767px]:px-3",
  header:
    "shrink-0 space-y-2 py-2 md:space-y-3 md:py-6 [@media(max-height:500px)]:py-1.5 [@media(max-height:500px)]:space-y-1.5",
  headerRow: "flex min-w-0 items-center gap-2 md:justify-between",
  main: "min-h-0 min-w-0 flex-1 w-full touch-manipulation overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] pb-[env(safe-area-inset-bottom,0px)]",
  boardGlass: "min-h-full min-w-0 rounded-xl p-2 max-[767px]:p-1.5",
  offlineLine: "text-2xs leading-snug text-muted-foreground/80",
} as const;
