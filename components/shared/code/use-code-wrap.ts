"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * Below this width code wraps by default: a phone shows about 25 columns, so scrolling sideways
 * to read a line is worse than a hanging indent. code.module.css repeats the same query for the
 * first paint, so a server-rendered block never flashes unwrapped before hydration.
 */
export const CODE_NARROW_QUERY = "(max-width: 40rem)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};

  const query = window.matchMedia(CODE_NARROW_QUERY);

  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getNarrow() {
  return typeof window.matchMedia === "function" && window.matchMedia(CODE_NARROW_QUERY).matches;
}

/**
 * Wrap state for a code view. `initial` is the author's default (wrap from the start). Until the
 * reader presses the toggle, a narrow screen wraps anyway ("auto"); once they choose, their
 * choice holds at every width.
 */
export function useCodeWrap(initial = false) {
  const narrow = useSyncExternalStore(subscribe, getNarrow, () => false);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const wrapped = chosen ?? (initial || narrow);
  const toggle = useCallback(() => setChosen(!wrapped), [wrapped]);

  return {
    /** What the reader sees right now; drives aria-pressed and the focus stop. */
    wrapped,
    /** Props for CodeSurface: an explicit state, or "auto" so CSS decides on a narrow screen. */
    surface: { wrap: chosen ?? initial, autoWrap: chosen === null && !initial },
    toggle,
  };
}
