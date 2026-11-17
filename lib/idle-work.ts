/**
 * Runs main-thread work in slices while the browser is idle, so it never competes with a page
 * load, a scroll, or typing for a frame.
 */

/** Longest a slice waits for idle time before it runs anyway. Generous: a forced slice lands mid-interaction. */
export const IDLE_WORK_TIMEOUT_MS = 2_000;

/** Without `requestIdleCallback` (Safari): gap between slices, and work per slice (half a frame). */
export const IDLE_WORK_FALLBACK_GAP_MS = 50;
export const IDLE_WORK_FALLBACK_SLICE_MS = 8;

/** Minimum idle time left, in ms, to start another unit of work. */
const MIN_TIME_LEFT_MS = 1;

/**
 * One slice of work. Do one unit, then another while `hasTimeLeft()` is true; the first call in
 * each slice always returns true, so every slice makes progress. Return true when finished.
 */
export type IdleSliceTask = (hasTimeLeft: () => boolean) => boolean;

/** Starts `task` at the next idle period and keeps slicing until it finishes. Returns a cancel. */
export function runInIdleSlices(task: IdleSliceTask): () => void {
  // Captured once, so cancelling uses the same API that scheduled.
  const idle =
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function" &&
    typeof window.cancelIdleCallback === "function"
      ? {
          request: window.requestIdleCallback.bind(window),
          cancel: window.cancelIdleCallback.bind(window),
        }
      : null;
  let cancelled = false;
  let idleHandle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const runSlice = (deadline?: IdleDeadline) => {
    if (cancelled) return;

    const sliceEnd = performance.now() + IDLE_WORK_FALLBACK_SLICE_MS;
    let first = true;
    const hasTimeLeft = () => {
      if (first) {
        first = false;

        return true;
      }

      return deadline
        ? deadline.timeRemaining() > MIN_TIME_LEFT_MS
        : performance.now() < sliceEnd - MIN_TIME_LEFT_MS;
    };

    if (!task(hasTimeLeft)) schedule();
  };

  const schedule = () => {
    if (idle) {
      idleHandle = idle.request(runSlice, { timeout: IDLE_WORK_TIMEOUT_MS });
    } else {
      timer = setTimeout(() => runSlice(), IDLE_WORK_FALLBACK_GAP_MS);
    }
  };

  schedule();

  return () => {
    cancelled = true;
    if (idle && idleHandle !== undefined) idle.cancel(idleHandle);
    if (timer !== undefined) clearTimeout(timer);
  };
}
