"use client";

import { FrameLoop, solveSpring, type SpringConfig } from "@organic-llm/morph-physics";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

type Offset = { x: number; y: number };

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
 * Keep an element visually anchored across layout changes. When `layoutKey` changes and the
 * element lands somewhere else, it is offset back to where it was and the offset springs to zero
 * with morph-physics (FLIP). Transform only — the element stays in normal flow, keeps its state,
 * and is never rendered twice.
 *
 * The anchor is the element's bottom-left corner, so a composer growing upward as the user types
 * does not read as a move.
 */
export function useMorphFlip(
  ref: RefObject<HTMLElement | null>,
  layoutKey: string,
  options: { spring: SpringConfig; minShiftPx: number; disabled?: boolean }
): void {
  const resting = useRef<Offset | null>(null);
  const offset = useRef<Offset>({ x: 0, y: 0 });
  const velocity = useRef<Offset>({ x: 0, y: 0 });
  const loop = useRef<FrameLoop | null>(null);
  const { spring, minShiftPx, disabled } = options;

  // Untransformed bottom-left, so a running animation does not skew the next measurement.
  const measure = (el: HTMLElement): Offset => {
    const rect = el.getBoundingClientRect();

    return { x: rect.left - offset.current.x, y: rect.bottom - offset.current.y };
  };

  const apply = (el: HTMLElement) => {
    const { x, y } = offset.current;

    el.style.transform = x === 0 && y === 0 ? "" : `translate3d(${x}px, ${y}px, 0)`;
  };

  // Moves nobody animated (window resize, keyboard, the element's own growth) re-baseline silently.
  useEffect(() => {
    const el = ref.current;

    if (!el) return;
    const rebaseline = () => {
      if (!loop.current) resting.current = measure(el);
    };
    const observer = new ResizeObserver(rebaseline);

    observer.observe(el);
    window.addEventListener("resize", rebaseline);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", rebaseline);
      loop.current?.stop();
      loop.current = null;
    };
  }, [ref]);

  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) return;
    const before = resting.current;
    const after = measure(el);

    resting.current = after;
    if (!before) return;

    const dx = before.x + offset.current.x - after.x;
    const dy = before.y + offset.current.y - after.y;

    if (disabled || (Math.abs(dx) < minShiftPx && Math.abs(dy) < minShiftPx)) {
      loop.current?.stop();
      loop.current = null;
      offset.current = { x: 0, y: 0 };
      velocity.current = { x: 0, y: 0 };
      apply(el);

      return;
    }

    offset.current = { x: dx, y: dy };
    apply(el);

    if (loop.current) return;
    const frames = new FrameLoop(({ deltaTime }) => {
      const next = stepFlipOffset(offset.current, velocity.current, spring, deltaTime);

      offset.current = next.offset;
      velocity.current = next.velocity;
      apply(el);

      if (next.settled) {
        frames.stop();
        loop.current = null;
      }
    });

    loop.current = frames;
    frames.start();
  }, [layoutKey]);
}
