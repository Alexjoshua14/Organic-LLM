"use client";

import { FrameLoop, solveSpring, type SpringConfig } from "@organic-llm/morph-physics";
import { type RefObject, useLayoutEffect, useRef } from "react";

type Offset = { x: number; y: number };
type Layout = Offset & { width: number };

/** Below these the offset is at rest. */
const SETTLE_OFFSET_PX = 0.5;
const SETTLE_VELOCITY_PX_S = 4;

/**
 * One spring step of a FLIP offset toward zero. Pure — exported for tests.
 */
export function stepFlipOffset(
  offset: Offset,
  velocity: Offset,
  spring: SpringConfig,
  deltaTimeMs: number
): { offset: Offset; velocity: Offset; settled: boolean } {
  const x = solveSpring(offset.x, 0, velocity.x, spring, deltaTimeMs);
  const y = solveSpring(offset.y, 0, velocity.y, spring, deltaTimeMs);
  const settled =
    Math.abs(x.position) < SETTLE_OFFSET_PX &&
    Math.abs(y.position) < SETTLE_OFFSET_PX &&
    Math.abs(x.velocity) < SETTLE_VELOCITY_PX_S &&
    Math.abs(y.velocity) < SETTLE_VELOCITY_PX_S;

  return settled
    ? { offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, settled }
    : {
        offset: { x: x.position, y: y.position },
        velocity: { x: x.velocity, y: y.velocity },
        settled,
      };
}

/**
 * Keep an element's position and width continuous across layout and viewport changes. CSS owns
 * the final layout; one bottom-left transform springs from the previous visible bounds to it.
 * Resize observations retarget the existing spring instead of discarding its geometry. The
 * element stays in normal flow, keeps its state, and is never rendered twice.
 *
 * The anchor is the element's bottom-left corner, so a composer growing upward as the user types
 * does not read as a move.
 */
export function useMorphFlip(
  ref: RefObject<HTMLElement | null>,
  layoutKey: string,
  options: { spring: SpringConfig; minShiftPx: number; disabled?: boolean }
): void {
  const updateLayout = useRef<(() => void) | null>(null);
  const { spring, minShiftPx, disabled } = options;

  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) return;
    let resting: Layout | null = null;
    let offset: Offset = { x: 0, y: 0 };
    let velocity: Offset = { x: 0, y: 0 };
    let scale = 1;
    let scaleVelocity = 0;
    let loop: FrameLoop | null = null;
    let viewportWidth = window.innerWidth;

    const clear = () => {
      loop?.stop();
      loop = null;
      offset = { x: 0, y: 0 };
      velocity = { x: 0, y: 0 };
      scale = 1;
      scaleVelocity = 0;
      el.style.transform = "";
      el.style.willChange = "";
    };
    const measure = (): Layout => {
      const rect = el.getBoundingClientRect();

      return { x: rect.left - offset.x, y: rect.bottom - offset.y, width: rect.width / scale };
    };
    const apply = () => {
      el.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) scaleX(${scale})`;
    };
    const transition = () => {
      const before = resting;
      const after = measure();

      resting = after;
      if (disabled || after.width <= 0 || !before || before.width <= 0) {
        clear();

        return;
      }

      const dx = before.x + offset.x - after.x;
      const dy = before.y + offset.y - after.y;
      const visibleWidth = before.width * scale;

      if (
        !loop &&
        Math.abs(dx) < minShiftPx &&
        Math.abs(dy) < minShiftPx &&
        Math.abs(visibleWidth - after.width) < minShiftPx
      )
        return;

      offset = { x: dx, y: dy };
      scaleVelocity *= before.width / after.width;
      scale = visibleWidth / after.width;
      el.style.willChange = "transform";
      apply();

      if (loop) return;
      const frames = new FrameLoop(({ deltaTime }) => {
        const next = stepFlipOffset(offset, velocity, spring, deltaTime);
        const width = solveSpring(scale, 1, scaleVelocity, spring, deltaTime);

        offset = next.offset;
        velocity = next.velocity;
        scale = width.position;
        scaleVelocity = width.velocity;
        apply();

        if (
          next.settled &&
          Math.abs(scale - 1) * resting!.width < SETTLE_OFFSET_PX &&
          Math.abs(scaleVelocity) * resting!.width < SETTLE_VELOCITY_PX_S
        )
          clear();
      });

      loop = frames;
      frames.start();
    };
    // Width changes can arrive before React's breakpoint commit. Preserve the visible box
    // through both steps; height-only growth (typing) just updates the bottom-left baseline.
    const observe = () => {
      const after = measure();

      if (resting && Math.abs(after.width - resting.width) >= minShiftPx) transition();
      else if (!loop) resting = after;
    };
    const observer = new ResizeObserver(observe);
    const resize = () => {
      const nextWidth = window.innerWidth;

      if (nextWidth !== viewportWidth) transition();
      else {
        // Height-only viewport changes (notably the mobile keyboard) must stay docked.
        clear();
        resting = measure();
      }
      viewportWidth = nextWidth;
    };

    el.style.transformOrigin = "left bottom";
    updateLayout.current = transition;
    transition();
    observer.observe(el);
    window.addEventListener("resize", resize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      updateLayout.current = null;
      clear();
      el.style.transformOrigin = "";
    };
  }, [ref, spring, minShiftPx, disabled]);

  useLayoutEffect(() => {
    updateLayout.current?.();
  }, [layoutKey]);
}
