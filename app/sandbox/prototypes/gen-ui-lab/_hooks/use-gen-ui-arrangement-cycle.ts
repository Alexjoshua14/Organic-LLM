"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Give each arrangement enough reading time; interaction restarts a full reading window. */
export const GEN_UI_ARRANGEMENT_INTERVAL_MS = 8_000;

/** One preset a gallery page can step through. `name` and `intent` fill the section toolbar. */
export type GenUiArrangement = {
  id: string;
  name: string;
  intent: string;
};

/**
 * Manual prev/next through a fixed list of arrangements, plus an opt-in Auto cycle. Auto runs only
 * while the page is `active` and pauses on hover, focus, a hidden tab, or reduced motion. Stepping
 * by hand turns Auto off.
 */
export function useGenUiArrangementCycle<T extends GenUiArrangement>(
  arrangements: ReadonlyArray<T>,
  active = true
) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion() === true;
  const count = arrangements.length;
  const arrangement = arrangements[index % count]!;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);

    update();
    document.addEventListener("visibilitychange", update);

    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!active || !auto || hovered || focused || !visible || reducedMotion) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % count),
      GEN_UI_ARRANGEMENT_INTERVAL_MS
    );

    return () => window.clearInterval(timer);
  }, [active, auto, hovered, focused, visible, reducedMotion, count]);

  const step = (direction: number) => {
    setAuto(false);
    setIndex((current) => (current + direction + count) % count);
  };

  return {
    index,
    count,
    arrangement,
    auto,
    reducedMotion,
    step,
    /** Jump to an arrangement by hand; like stepping, it turns Auto off. */
    select: (next: number) => {
      setAuto(false);
      setIndex(((next % count) + count) % count);
    },
    toggleAuto: () => setAuto((current) => !current),
    setHovered,
    setFocused,
  };
}

export type GenUiArrangementCycle<T extends GenUiArrangement = GenUiArrangement> = ReturnType<
  typeof useGenUiArrangementCycle<T>
>;
