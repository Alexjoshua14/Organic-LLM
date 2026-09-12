import { flushSync } from "react-dom";

type RunViewTransitionOptions = {
  /** When true, apply the state update immediately without a view transition. */
  skip?: boolean;
};

/**
 * Runs a DOM update inside the View Transitions API when supported.
 * Falls back to a synchronous update when transitions are unavailable or skipped.
 */
export function runViewTransition(update: () => void, options?: RunViewTransitionOptions): void {
  if (options?.skip) {
    update();
    return;
  }

  if (typeof document === "undefined" || !document.startViewTransition) {
    update();
    return;
  }

  document.startViewTransition(() => {
    flushSync(update);
  });
}
