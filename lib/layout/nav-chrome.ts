/**
 * Shared inset classes for clearing global nav chrome:
 * - SidebarTrigger (top-left, mobile w-20 h-14; desktop top-4 pl-4 + size-9 icon)
 * - ControlCluster (top-right, w-24 h-14; md:translate-y-4 when sidebar open on inset pages)
 *
 * Full-bleed pages (`data-page-chrome="full-bleed"`) skip the inset offset — see globals.css.
 */
export const triggerInsetX = "pl-24 md:pl-16";
export const clusterInsetX = "pr-20 md:pr-10";
export const triggerInsetY =
  "pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-10";

/** Same vertical band as SidebarTrigger — content beside the toggle, not below it. */
export const triggerRowAlignY =
  "pt-[env(safe-area-inset-top,0px)] min-h-14 md:pt-4 md:min-h-9";

export const pageTopBarInsets = `${triggerInsetX} ${clusterInsetX}`;
export const pageContentFrameInsets = `${triggerInsetX} ${clusterInsetX} ${triggerInsetY}`;
