"use client";

import { useStickToBottomContext } from "use-stick-to-bottom";
import { useEffect, useLayoutEffect, useRef } from "react";

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
 * Must render inside {@link Conversation} / StickToBottom.
 */
export function NoesisScrollPersistence({ threadId, messageCount }: NoesisScrollPersistenceProps) {
  const { scrollRef, contentRef, scrollToBottom, stopScroll } = useStickToBottomContext();

  const restoredRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const snapshotRef = useRef(loadNoesisScrollSnapshot(threadId));

  useEffect(() => {
    snapshotRef.current = loadNoesisScrollSnapshot(threadId);
    restoredRef.current = false;
  }, [threadId]);

  useLayoutEffect(() => {
    if (restoredRef.current) return;

    const snapshot = snapshotRef.current;
    let cancelled = false;
    let frame = 0;
    let attempts = 0;

    const tryRestore = () => {
      if (cancelled || restoredRef.current) return true;

      const scrollEl = scrollRef.current;

      if (!scrollEl || scrollEl.clientHeight === 0) return false;

      if (!snapshot) {
        restoredRef.current = true;

        return true;
      }

      if (snapshot.isAtBottom) {
        scrollToBottom({ animation: "instant" });
      } else {
        stopScroll();
        const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);

        scrollEl.scrollTop = Math.min(snapshot.scrollTop, maxScrollTop);
      }

      restoredRef.current = true;

      return true;
    };

    const tick = () => {
      if (tryRestore() || attempts++ > 90) return;
      frame = requestAnimationFrame(tick);
    };

    tick();

    const contentEl = contentRef.current;

    if (!contentEl) {
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }

    const observer = new ResizeObserver(() => {
      if (tryRestore()) observer.disconnect();
    });

    observer.observe(contentEl);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
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
