"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type MobileSheetSnap = "collapsed" | "half" | "full";

const COLLAPSED_VISIBLE_PX = 72;
const SPRING = { type: "spring" as const, stiffness: 420, damping: 40 };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function useViewportHeight() {
  const [vh, setVh] = useState(800);

  useEffect(() => {
    const update = () => setVh(typeof window !== "undefined" ? window.innerHeight : 800);

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  return vh;
}

export interface MobileBottomSheetProps {
  /** Extra class on the sheet panel */
  className?: string;
  /** Summary row shown below handle (e.g. source/branch counts) */
  summaryRow?: React.ReactNode;
  /** Scrollable body (sources, branches) */
  children: React.ReactNode;
  /** Sticky footer inside sheet (prompt bar) */
  footer: React.ReactNode;
  /** Called when snap level changes (for scroll lock / padding) */
  onSnapChange?: (snap: MobileSheetSnap) => void;
}

export function MobileBottomSheet({
  className,
  summaryRow,
  children,
  footer,
  onSnapChange,
}: MobileBottomSheetProps) {
  const vh = useViewportHeight();
  const maxSheet = useMemo(() => Math.round(vh * 0.9), [vh]);
  const halfVisible = useMemo(() => Math.round(vh * 0.5), [vh]);

  const yFull = 0;
  const yHalf = useMemo(() => Math.max(0, maxSheet - halfVisible), [maxSheet, halfVisible]);
  const yCollapsed = useMemo(() => Math.max(0, maxSheet - COLLAPSED_VISIBLE_PX), [maxSheet]);

  const y = useMotionValue(yCollapsed);
  const [snap, setSnap] = useState<MobileSheetSnap>("collapsed");
  const snapRef = useRef(snap);

  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);

  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const pointerStartY = useRef(0);
  const pointerStartX = useRef(0);
  const dragMovedRef = useRef(false);
  const lastTapRef = useRef(0);

  const announceSnap = useCallback(
    (next: MobileSheetSnap) => {
      setSnap(next);
      onSnapChange?.(next);
    },
    [onSnapChange]
  );

  const snapToNearest = useCallback(
    (currentY: number, velocityY: number) => {
      const points = [
        { key: "full" as const, y: yFull },
        { key: "half" as const, y: yHalf },
        { key: "collapsed" as const, y: yCollapsed },
      ];

      if (velocityY > 700) {
        const next = currentY < yHalf ? "half" : "collapsed";
        const target = next === "half" ? yHalf : yCollapsed;

        animate(y, target, SPRING);
        announceSnap(next);

        return;
      }
      if (velocityY < -700) {
        const next = currentY > yHalf ? "half" : "full";
        const target = next === "half" ? yHalf : yFull;

        animate(y, target, SPRING);
        announceSnap(next);

        return;
      }

      let best = points[0];
      let bestDist = Math.abs(currentY - points[0].y);

      for (const p of points) {
        const d = Math.abs(currentY - p.y);

        if (d < bestDist) {
          best = p;
          bestDist = d;
        }
      }

      animate(y, best.y, SPRING);
      announceSnap(best.key);
    },
    [announceSnap, y, yCollapsed, yFull, yHalf]
  );

  useEffect(() => {
    const target =
      snapRef.current === "full" ? yFull : snapRef.current === "half" ? yHalf : yCollapsed;

    y.set(target);
  }, [y, yCollapsed, yFull, yHalf]);

  useEffect(() => {
    const locked = snap === "full" || snap === "half";

    if (locked) {
      const prev = document.body.style.overflow;

      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = prev;
      };
    }

    return undefined;
  }, [snap]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    dragMovedRef.current = false;
    dragStartY.current = y.get();
    pointerStartY.current = e.clientY;
    pointerStartX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = e.clientY - pointerStartY.current;
    const dx = e.clientX - pointerStartX.current;

    if (Math.abs(dy) > 8 || Math.abs(dx) > 8) {
      dragMovedRef.current = true;
    }

    const next = clamp(dragStartY.current + dy, yFull, yCollapsed);

    y.set(next);
  };

  const endDrag = (e: React.PointerEvent, velocityY: number) => {
    if (!dragging.current) return;
    dragging.current = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (!dragMovedRef.current) {
      const now = Date.now();

      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        const nextSnap = snapRef.current === "full" ? "collapsed" : "full";
        const targetY = nextSnap === "full" ? yFull : yCollapsed;

        animate(y, targetY, SPRING);
        announceSnap(nextSnap);

        return;
      }

      lastTapRef.current = now;
    }

    snapToNearest(y.get(), velocityY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    endDrag(e, 0);
  };

  return (
    <motion.div
      className="rabbit-hole-mobile-bottom-sheet pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center"
      style={{ height: maxSheet }}
    >
      <motion.div
        className={cn(
          "pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border/50 shadow-xl",
          glass({ opaque: true }),
          className
        )}
        style={{ height: maxSheet, y, touchAction: "pan-y" }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2 pb-2 active:cursor-grabbing"
          onPointerCancel={(e) => endDrag(e, 0)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div aria-hidden className="mb-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35" />
          {summaryRow ? <div className="w-full shrink-0 px-4 pb-1">{summaryRow}</div> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
          {children}
        </div>

        <div className="rabbit-hole-mobile-sheet-footer shrink-0 border-t border-border/30 mobile-safe-bottom px-3 pb-2 pt-2">
          {footer}
        </div>
      </motion.div>
    </motion.div>
  );
}
