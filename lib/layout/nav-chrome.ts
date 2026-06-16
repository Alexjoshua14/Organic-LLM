/**
 * Shared inset classes for clearing global nav chrome:
 * - SidebarTrigger (top-left, mobile w-20 h-14; desktop top-4 pl-4 + icon)
 * - ControlCluster (top-right, w-24 h-14; md:translate-y-4 when sidebar open on inset pages)
 *
 * Full-bleed pages (`data-page-chrome="full-bleed"`) skip the inset offset — see globals.css.
 */
export const triggerInsetX = "pl-20 md:pl-14";
export const clusterInsetX = "pr-20 md:pr-10";
export const triggerInsetY = "pt-16 md:pt-10";

export const pageTopBarInsets = `${triggerInsetX} ${clusterInsetX}`;
export const pageContentFrameInsets = `${triggerInsetX} ${clusterInsetX} ${triggerInsetY}`;
