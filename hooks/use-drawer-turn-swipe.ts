"use client";

import { useCallback, useRef } from "react";

export type DrawerSwipeDirection = "older" | "newer";

export type UseDrawerTurnSwipeOptions = {
  turnCount: number;
  turnIndex: number;
  onTurnIndexChange: (index: number) => void;
  aiScrollRef?: React.RefObject<HTMLElement | null>;
};

const MIN_DY = 56;
const MAX_DT_MS = 700;

export { MIN_DY };

export function useDrawerTurnSwipe({
  turnCount,
  turnIndex,
  onTurnIndexChange,
  aiScrollRef,
}: UseDrawerTurnSwipeOptions) {
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const canSwipeUp = useCallback(() => {
    const el = aiScrollRef?.current;

    if (!el) return true;

    return el.scrollTop <= 2;
  }, [aiScrollRef]);

  const canSwipeDown = useCallback(() => {
    const el = aiScrollRef?.current;

    if (!el) return true;

    return el.scrollHeight - el.scrollTop - el.clientHeight <= 2;
  }, [aiScrollRef]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.changedTouches[0];

    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchRef.current;

      touchRef.current = null;
      if (!start || turnCount <= 1) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Math.max(1, Date.now() - start.t);

      if (Math.abs(dy) < MIN_DY || Math.abs(dy) < Math.abs(dx) * 1.2 || dt > MAX_DT_MS) {
        return;
      }

      if (dy < 0 && canSwipeUp() && turnIndex > 0) {
        onTurnIndexChange(turnIndex - 1);
      } else if (dy > 0 && canSwipeDown() && turnIndex < turnCount - 1) {
        onTurnIndexChange(turnIndex + 1);
      }
    },
    [canSwipeDown, canSwipeUp, onTurnIndexChange, turnCount, turnIndex]
  );

  return { onTouchStart, onTouchEnd };
}
