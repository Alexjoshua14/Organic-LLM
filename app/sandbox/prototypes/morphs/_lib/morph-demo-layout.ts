/**
 * Morph sandbox layout — breakpoints and chrome clearances.
 * Tailwind fragments below must stay in sync with the px constants.
 */

/** Dev HUD width when side-docked (`18rem`). */
export const MORPH_DEMO_HUD_SIDE_WIDTH_PX = 288;

/**
 * Min viewport width for a side-docked HUD.
 * Below this, the HUD overlays as a top sheet so the stage is not squeezed.
 * Encoded in classes as Tailwind `sm` (640px).
 */
export const MORPH_DEMO_HUD_SIDE_MIN_WIDTH_PX = 640;

/**
 * Below this height, hide verbose header copy so stage + controls stay on-screen
 * (short landscape phones). Encoded as `@max-h-[500px]:`.
 */
export const MORPH_DEMO_SHORT_VIEWPORT_MAX_HEIGHT_PX = 500;

/** Side rail width for chat↔rabbit absolute rails (matches explorer). */
export const MORPH_DEMO_RAIL_WIDTH_PX = 260;

export const morphDemoChrome = {
  /** Page shell: allow vertical scroll on short viewports; never horizontal page scroll. */
  page: "items-stretch justify-start gap-0 overflow-x-hidden overflow-y-auto",
  /** Header never reserves HUD width — HUD overlays (side or top sheet). */
  header: "shrink-0 px-4 pt-4 text-center pr-4",
  /** Long blurb — hide on short landscape so canvas/controls fit. */
  headerBody: "[@media(max-height:500px)]:hidden",
  stage:
    "relative mt-2 min-h-0 w-full min-w-0 flex-1 px-2 sm:mt-4 sm:px-4 max-sm:min-h-[min(48dvh,420px)] sm:min-h-[min(72vh,640px)]",
  stageChatRabbit:
    "relative w-full min-w-0 flex-1 mt-2 sm:mt-4 px-2 sm:px-4 max-sm:min-h-[min(42dvh,360px)] sm:min-h-[min(72vh,680px)]",
  morphButtonRow:
    "pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-4",
} as const;

export const morphDemoHud = {
  /**
   * Open panel: top sheet under nav on narrow; side dock from `sm` up
   * (`MORPH_DEMO_HUD_SIDE_MIN_WIDTH_PX`).
   */
  openPanel: cnJoin(
    "pointer-events-auto fixed z-[60] overflow-y-auto border border-border/60 p-2 shadow-lg backdrop-blur-xl",
    "inset-x-2 top-[calc(4.5rem+env(safe-area-inset-top,0px))] max-h-[min(42dvh,22rem)] rounded-xl",
    "sm:inset-x-auto sm:right-0 sm:top-24 sm:max-h-[calc(100dvh-6rem)] sm:w-full sm:max-w-[min(100vw-1rem,18rem)] sm:rounded-l-xl sm:rounded-r-none sm:border-r-0"
  ),
  /**
   * Collapsed affordance: chip top-right on narrow; vertical side tab from `sm` up.
   */
  collapsedTab: cnJoin(
    "pointer-events-auto fixed z-[60] border border-border/60 shadow-lg backdrop-blur-xl",
    "top-[calc(4.5rem+env(safe-area-inset-top,0px))] right-2 flex items-center gap-1 rounded-lg px-2.5 py-1.5",
    "sm:top-24 sm:right-0 sm:w-9 sm:flex-col sm:gap-1.5 sm:rounded-l-lg sm:rounded-r-none sm:border-r-0 sm:px-0 sm:py-3 sm:pl-1 sm:pr-0.5"
  ),
} as const;

/** Tiny join helper so layout constants stay readable without importing `cn`. */
function cnJoin(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Chat↔rabbit rails: absolute side panels on `lg+`; stacked path/sources on narrow
 * when the rabbit archetype is active (production explorer stacks below 1032px).
 */
export const morphDemoRabbitRails = {
  sideLayer: "pointer-events-none absolute inset-0 z-10 hidden lg:block",
  sideRailWidth: "w-[260px] max-w-[260px]",
  /** Stacked chrome around the morph stage on narrow viewports. */
  stack: "flex min-h-0 w-full min-w-0 flex-col gap-3 px-2 lg:hidden",
  stackPath: "min-w-0 shrink-0",
  stackSources:
    "min-w-0 max-h-[min(28vh,220px)] shrink-0 overflow-y-auto overscroll-y-contain pb-20",
} as const;
