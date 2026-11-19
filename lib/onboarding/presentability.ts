import { isOnboardingHeld } from "./onboarding-blockers";

/**
 * DOM checks for feature tips. Both are injectable into `FeatureTipLayer` because the test
 * environment (JSDOM) has no layout.
 */

export type AnchorProbe = (element: HTMLElement) => boolean;
export type OverlayProbe = (doc: Document) => boolean;

/** At least this share of the anchor must be inside the viewport. */
const MIN_VISIBLE_SHARE = 0.5;

/**
 * True when a person can actually see the anchor: attached, sized, mostly on screen, not hidden by
 * `visibility`/`opacity` (CoreInput hides its controls until settings load), and not covered by
 * another layer at its centre.
 */
export const isAnchorPresentable: AnchorProbe = (element) => {
  if (!element.isConnected) return false;

  const view = element.ownerDocument.defaultView;

  if (!view) return false;

  const rect = element.getBoundingClientRect();

  if (rect.width < 1 || rect.height < 1) return false;

  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.right, view.innerWidth);
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, view.innerHeight);
  const visibleArea = Math.max(0, right - left) * Math.max(0, bottom - top);

  if (visibleArea < MIN_VISIBLE_SHARE * rect.width * rect.height) return false;

  if (
    typeof element.checkVisibility === "function" &&
    !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  ) {
    return false;
  }

  const doc = element.ownerDocument;

  if (typeof doc.elementFromPoint !== "function") return true;

  const hit = doc.elementFromPoint((left + right) / 2, (top + bottom) / 2);

  return hit != null && element.contains(hit);
};

/** Open layers that a tip must never compete with. The tip itself is excluded. */
const BLOCKING_SELECTORS = [
  '[role="dialog"][data-state="open"]:not([data-feature-tip])',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
].join(",");

/**
 * True while a dialog, sheet, menu, popover, select or other floating layer is open, the
 * page is scroll-locked by one, or another first-visit notice holds onboarding (see
 * `onboarding-blockers.ts`). Checked when a tip is about to show and while one is visible.
 */
export const isBlockingOverlayOpen: OverlayProbe = (doc) => {
  if (isOnboardingHeld()) return true;
  if (doc.body?.hasAttribute("data-scroll-locked")) return true;
  if (doc.querySelector(BLOCKING_SELECTORS)) return true;

  // Radix Select can mount its listbox before setting any open-state attributes.
  return Boolean(doc.querySelector('[data-radix-popper-content-wrapper] [role="listbox"]'));
};
