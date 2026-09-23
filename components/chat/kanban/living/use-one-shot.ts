"use client";

import type { RefObject } from "react";

import { useReducedMotion } from "framer-motion";
import { useLayoutEffect } from "react";

/**
 * Plays `keyframes` on the element once each time `stamp` changes — including on mount, so a
 * card that just changed lanes lights up in its new home. Runs through the Web Animations API:
 * opacity and transform stay on the compositor, and nothing re-renders. The element's own
 * styles are its resting state; a newer change is left to overlap rather than cut the last.
 */
export function useOneShot(
  ref: RefObject<HTMLElement | null>,
  stamp: number | undefined,
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions
): void {
  const reduceMotion = useReducedMotion() ?? false;

  useLayoutEffect(() => {
    const el = ref.current;

    if (stamp === undefined || reduceMotion || typeof el?.animate !== "function") return;
    el.animate(keyframes, timing);
  }, [stamp]);
}
