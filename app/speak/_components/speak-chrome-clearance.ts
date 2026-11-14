/**
 * Keeps the Speak header out from under the app's own chrome (`app/session-shell.tsx`,
 * `components/layout/countrol-cluster.tsx`). Both are absolutely positioned over the page:
 *
 * - **Phones:** a 3.5rem bar across the top holds the sidebar toggle (left) and the control
 *   cluster (right), so the header starts below it, under the safe-area inset.
 * - **md and up:** the sidebar toggle floats at the top-left (16px inset, ~36px wide) whether the
 *   sidebar is open or collapsed, and the 9.5rem control cluster takes the top-right. The header
 *   leaves room for each, so its right-hand controls (allowance, transcript, call settings) are
 *   never covered.
 *
 * If the chrome's dimensions change, change them here, in one place.
 */
export const SPEAK_HEADER_CLEARANCE =
  "px-inset-md pt-[calc(env(safe-area-inset-top,0px)+3.75rem)] md:pl-16 md:pr-40 md:pt-4";
