import type { NoesisScrollSnapshot } from "@/lib/sandbox/noesis-scroll-storage";

/** Target: restore completes before paint within this window (imperceptible). */
export const NOESIS_SCROLL_RESTORE_BUDGET_MS = 75;

export type NoesisScrollRestoreHandlers = {
  scrollToBottom: (options?: { animation?: "instant" }) => void;
  stopScroll: () => void;
};

export type NoesisScrollRestoreResult = {
  applied: boolean;
  /** True when scroll height was not yet tall enough for the saved offset. */
  deferred: boolean;
};

export function clampScrollTop(scrollEl: HTMLElement, scrollTop: number): number {
  const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);

  return Math.min(Math.max(0, scrollTop), maxScrollTop);
}

export function needsDeferredNoesisScrollRestore(
  scrollEl: HTMLElement,
  snapshot: NoesisScrollSnapshot
): boolean {
  if (snapshot.isAtBottom) return false;

  const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);

  return maxScrollTop + 1 < snapshot.scrollTop;
}

export function applyNoesisScrollSnapshot(
  scrollEl: HTMLElement,
  snapshot: NoesisScrollSnapshot | null,
  handlers: NoesisScrollRestoreHandlers
): NoesisScrollRestoreResult {
  if (!snapshot) {
    return { applied: true, deferred: false };
  }

  if (scrollEl.clientHeight === 0) {
    return { applied: false, deferred: true };
  }

  handlers.stopScroll();

  if (snapshot.isAtBottom) {
    handlers.scrollToBottom({ animation: "instant" });

    return { applied: true, deferred: false };
  }

  const deferred = needsDeferredNoesisScrollRestore(scrollEl, snapshot);

  scrollEl.scrollTop = clampScrollTop(scrollEl, snapshot.scrollTop);

  return { applied: true, deferred };
}

export type NoesisScrollRestoreStatus = {
  durationMs: number;
  restored: boolean;
  deferred: boolean;
};

/**
 * Logs a warning (never throws) when restore exceeds the budget.
 * Unit tests assert this hook; CI timing is not representative of real devices.
 */
export function reportNoesisScrollRestoreStatus(status: NoesisScrollRestoreStatus): void {
  if (!status.restored) return;

  if (status.durationMs > NOESIS_SCROLL_RESTORE_BUDGET_MS) {
    console.warn(
      `[noesis-scroll] restore took ${status.durationMs.toFixed(1)}ms (budget ${NOESIS_SCROLL_RESTORE_BUDGET_MS}ms)` +
        (status.deferred ? " — content height caught up after first paint" : "")
    );
  }
}
