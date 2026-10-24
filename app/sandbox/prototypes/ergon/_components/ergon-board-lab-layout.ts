/**
 * Ergon living-board lab layout — when the sticky chrome and width presets fit.
 *
 * Above this width the lab keeps its desktop control row (light, compare, width,
 * transport). At or below, controls stack, width presets hide (the viewport is
 * already ≤ the chat width), and the board stays full-bleed with lane scroll
 * inside LivingBoard — never a crushed multi-column page grid.
 *
 * Tailwind `max-[720px]:…` / `min-[721px]:…` classes must stay in sync with
 * {@link ERGON_LAB_NARROW_MAX_PX}. Short-height classes use
 * `[@media(max-height:500px)]:…` in sync with {@link ERGON_LAB_SHORT_MAX_PX}.
 */

/** Max CSS px where the lab uses the stacked (phone) chrome. */
export const ERGON_LAB_NARROW_MAX_PX = 720;

/**
 * Short viewport (landscape phone ~390px tall): compact sticky chrome and a
 * tighter board scroller so transport stays on screen.
 * Encoded as `[@media(max-height:500px)]:`.
 */
export const ERGON_LAB_SHORT_MAX_PX = 500;

/**
 * Static Tailwind fragments for the lab shell.
 * Arbitrary max-/min- variants must equal {@link ERGON_LAB_NARROW_MAX_PX} ± 1.
 */
export const ergonBoardLabLayout = {
  /** Sticky control strip: row on desktop, stacked on narrow. */
  chrome:
    "sticky top-3 z-30 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border/50 px-3 py-2.5 max-[720px]:flex-col max-[720px]:items-stretch max-[720px]:gap-2 max-[720px]:px-2.5 [@media(max-height:500px)]:top-[max(0.5rem,env(safe-area-inset-top,0px))] [@media(max-height:500px)]:gap-1.5 [@media(max-height:500px)]:py-1.5",
  /** Light + compare cluster. */
  chromePrimary: "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 max-[720px]:w-full",
  /** Width presets — useless when the viewport is already ≤ chat width. */
  widthControl: "hidden min-[721px]:flex",
  /** Status + transport: trails on desktop, full-width row on narrow. */
  chromeTransport:
    "ml-auto flex min-w-0 items-center gap-1 max-[720px]:ml-0 max-[720px]:w-full max-[720px]:justify-between",
  status:
    "mr-2 min-w-0 max-w-[22rem] truncate text-2xs text-muted-foreground max-[720px]:mr-0 max-[720px]:max-w-none max-[720px]:flex-1 max-[720px]:whitespace-normal max-[720px]:break-words",
  /** Board / before wrappers: never widen the page; lanes scroll inside. */
  boardFrame: "w-full min-w-0 max-w-full",
  /** LivingBoard scroller override for short landscape phones. */
  boardScrollerShort: "[@media(max-height:500px)]:!max-h-[42dvh]",
  /** Legacy “Before” board scroller — same short-height cap. */
  legacyScroller:
    "max-h-[60vh] overflow-auto overscroll-x-contain px-3 pb-3 [scrollbar-width:thin] [@media(max-height:500px)]:max-h-[42dvh]",
} as const;
