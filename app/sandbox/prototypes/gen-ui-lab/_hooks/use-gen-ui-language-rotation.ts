"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Long enough to read a ten-line sample, short enough to feel like a rotation. */
export const GEN_UI_LANGUAGE_INTERVAL_MS = 4_000;

/**
 * Random order with even coverage: every item once per round, then a fresh shuffle. The first item
 * of a new round is never the last item of the previous one, so a language never shows twice in a
 * row. `see` takes an item out of the current round (a manual pick counts as shown).
 */
export function createShuffleBag<T>(items: ReadonlyArray<T>, random: () => number = Math.random) {
  let bag: T[] = [];
  let last: T | undefined;

  function refill() {
    bag = [...items];

    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));

      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    // `next` pops from the end; keep the seam from repeating the previous item.
    if (bag.length > 1 && bag[bag.length - 1] === last) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
    }
  }

  return {
    next(): T {
      if (bag.length === 0) refill();
      last = bag.pop()!;

      return last;
    },
    see(item: T) {
      const at = bag.indexOf(item);

      if (at !== -1) bag.splice(at, 1);
      last = item;
    },
    remaining: () => bag.length,
  };
}

/**
 * Which language a lab page shows: picked by hand, or shuffled. `initial` null means "no language
 * chosen yet" (the page's own default content). Shuffle runs only while `active` and pauses on
 * hover, focus, a hidden tab or reduced motion, like the preset cycle; picking by hand stops it.
 */
export function useGenUiLanguageRotation<T extends string>(
  languages: ReadonlyArray<T>,
  initial: T | null,
  active = true
) {
  const [language, setLanguage] = useState<T | null>(initial);
  const [auto, setAuto] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion() === true;
  const bag = useRef<ReturnType<typeof createShuffleBag<T>> | null>(null);
  const getBag = () => (bag.current ??= createShuffleBag(languages));

  useEffect(() => {
    const update = () => setVisible(!document.hidden);

    update();
    document.addEventListener("visibilitychange", update);

    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!active || !auto || hovered || focused || !visible || reducedMotion) return;
    const timer = setInterval(() => setLanguage(getBag().next()), GEN_UI_LANGUAGE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [active, auto, hovered, focused, visible, reducedMotion]);

  return {
    language,
    auto,
    reducedMotion,
    /** Pick a language by hand (null returns to the page's default); stops the shuffle. */
    select: (next: T | null) => {
      setAuto(false);
      if (next) getBag().see(next);
      setLanguage(next);
    },
    /** Starting the shuffle moves on at once, so the button visibly does something. */
    toggleAuto: () => {
      if (!auto) setLanguage(getBag().next());
      setAuto(!auto);
    },
    setHovered,
    setFocused,
  };
}

export type GenUiLanguageRotation<T extends string = string> = ReturnType<
  typeof useGenUiLanguageRotation<T>
>;
