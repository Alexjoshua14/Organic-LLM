/**
 * Strata workspace layout — when the assistant docks beside the main column.
 *
 * Below the threshold the assistant overlays as a full-viewport sheet so the
 * browser list (or page shell) keeps a readable full-width measure instead of
 * sharing a squeezed row with a ~26rem panel.
 *
 * Tailwind classes in {@link StrataWorkspace} must stay in sync with
 * {@link STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX} (encoded as `lg` / 1024).
 */

/** Docked assistant aside width (px). Matches `min(26rem, …)` ≈ 416. */
export const STRATA_ASSISTANT_PANEL_WIDTH_PX = 416;

/**
 * Minimum main-column measure (px) before docking the assistant beside content.
 * Roughly a readable phone-width list/card column.
 */
export const STRATA_MAIN_MIN_MEASURE_PX = 390;

/**
 * Min viewport width for side-by-side main + assistant.
 * Aligns with Tailwind `lg` (1024) — above main min + panel (~806) with room for chrome.
 */
export const STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX = 1024;

/** Short landscape / short viewports — keep chrome reachable inside the dvh shell. */
export const STRATA_SHORT_VIEWPORT_MAX_HEIGHT_PX = 500;

/**
 * Whether the workspace is wide enough to dock the assistant beside the main column.
 * `widthPx` is typically the viewport (or workspace container) inline size.
 */
export function strataUsesSideBySideAssistant(widthPx: number): boolean {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return false;

  return widthPx >= STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX;
}

/**
 * Static Tailwind fragments for {@link StrataWorkspace}.
 * `lg:` must equal {@link STRATA_ASSISTANT_SIDE_BY_SIDE_MIN_WIDTH_PX}.
 */
export const strataWorkspaceChrome = {
  /** Outer shell: never horizontal page scroll; lock to parent dvh height. */
  root: "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden lg:flex-row",
  /** Primary browser / page column — always full width below the dock breakpoint. */
  main: "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden",
  /**
   * Assistant pane: full-viewport overlay sheet below `lg`; docked aside from `lg` up.
   * Uses dvh + safe-area so short landscape phones keep the close control reachable.
   */
  aside:
    "fixed inset-0 z-40 flex h-dvh max-h-dvh w-full min-w-0 flex-col border-border/60 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] lg:static lg:z-auto lg:h-full lg:max-h-none lg:w-[min(26rem,100%)] lg:shrink-0 lg:border-l lg:pt-0 lg:pb-0",
  asideHeader:
    "flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2",
  asideBody: "min-h-0 min-w-0 flex-1 overflow-hidden",
} as const;

/**
 * Browser list page chrome.
 * Short-viewport media query must stay in sync with
 * {@link STRATA_SHORT_VIEWPORT_MAX_HEIGHT_PX}.
 */
export const strataBrowserChrome = {
  root: "w-full min-w-0 max-w-full space-y-8 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:space-y-10",
  /** Hide long blurb on short landscape so list + create stay on-screen. */
  hideOnShortViewport: "[@media(max-height:500px)]:hidden",
} as const;
