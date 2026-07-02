"use client";

import { useStickToBottomContext } from "use-stick-to-bottom";
import { useEffect, useLayoutEffect, useRef } from "react";

import {
  applyNoesisScrollSnapshot,
  reportNoesisScrollRestoreStatus,
} from "@/lib/sandbox/noesis-scroll-restore";
import {
  loadNoesisScrollSnapshot,
  saveNoesisScrollSnapshot,
} from "@/lib/sandbox/noesis-scroll-storage";

const SAVE_DEBOUNCE_MS = 120;
const AT_BOTTOM_OFFSET_PX = 70;

function readScrollSnapshot(scrollEl: HTMLElement) {
  const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);

  return {
    scrollTop: scrollEl.scrollTop,
    isAtBottom: maxScrollTop - scrollEl.scrollTop <= AT_BOTTOM_OFFSET_PX,
  };
}

type NoesisScrollPersistenceProps = {
  threadId: string;
  /** Re-run restore when message count changes (initial hydration). */
  messageCount: number;
};

/**
 * Restores and persists Noesis thread scroll position in localStorage.
 * Applies saved scroll synchronously in useLayoutEffect (before paint) when possible.
 * Must render inside {@link Conversation} / StickToBottom, after thread content.
 */
export function NoesisScrollPersistence({ threadId, messageCount }: NoesisScrollPersistenceProps) {
  const { scrollRef, contentRef, scrollToBottom, stopScroll } = useStickToBottomContext();

  const restoredRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const snapshotRef = useRef(loadNoesisScrollSnapshot(threadId));
  const restoreStartedAtRef = useRef<number | null>(null);
  const restoreDeferredRef = useRef(false);

  useEffect(() => {
    snapshotRef.current = loadNoesisScrollSnapshot(threadId);
    restoredRef.current = false;
    restoreStartedAtRef.current = null;
    restoreDeferredRef.current = false;
  }, [threadId]);

  useLayoutEffect(() => {
    if (restoredRef.current) return;

    restoreStartedAtRef.current ??= performance.now();

    const snapshot = snapshotRef.current;
    let cancelled = false;

    const finishRestore = (deferred: boolean) => {
      if (restoredRef.current || cancelled) return;

      restoredRef.current = true;
      restoreDeferredRef.current = deferred;

      const startedAt = restoreStartedAtRef.current ?? performance.now();

      reportNoesisScrollRestoreStatus({
        durationMs: performance.now() - startedAt,
        restored: true,
        deferred,
      });
    };

    const tryRestore = (): boolean => {
      if (cancelled || restoredRef.current) return true;

      const scrollEl = scrollRef.current;

      if (!scrollEl) return false;

      const result = applyNoesisScrollSnapshot(scrollEl, snapshot, {
        scrollToBottom,
        stopScroll,
      });

      if (!result.applied) return false;

      if (!result.deferred) {
        finishRestore(false);

        return true;
      }

      return false;
    };

    if (tryRestore()) {
      return () => {
        cancelled = true;
      };
    }

    const contentEl = contentRef.current;

    if (!contentEl) {
      return () => {
        cancelled = true;
      };
    }

    const observer = new ResizeObserver(() => {
      if (tryRestore()) {
        observer.disconnect();
        return;
      }

      const scrollEl = scrollRef.current;

      if (!scrollEl || !snapshot || snapshot.isAtBottom) return;

      stopScroll();
      scrollEl.scrollTop = Math.min(
        snapshot.scrollTop,
        Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)
      );
    });

    observer.observe(contentEl);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [contentRef, messageCount, scrollRef, scrollToBottom, stopScroll, threadId]);

  useEffect(() => {
    const scrollEl = scrollRef.current;

    if (!scrollEl) return;

    const persist = () => {
      const el = scrollRef.current;

      if (!el) return;
      saveNoesisScrollSnapshot(threadId, readScrollSnapshot(el));
    };

    const onScroll = () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(persist, SAVE_DEBOUNCE_MS);
    };

    const onPageHide = () => persist();

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onPageHide);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [messageCount, scrollRef, threadId]);

  return null;
}
