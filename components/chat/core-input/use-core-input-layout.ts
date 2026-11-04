"use client";

import type { RefObject } from "react";

import { useLayoutEffect, useRef, useState } from "react";

import { CORE_INPUT_LAYOUT } from "./layout-breakpoints";

export type CoreInputLayout = {
  /** Footer is wide enough to show text labels next to chip icons. */
  showLabels: boolean;
  /** Footer is narrow enough that secondary tools move to the overflow menu. */
  isCondensed: boolean;
};

/**
 * Watches the prompt shell's width and reports which footer layout fits. Each flag has its own
 * enter and leave threshold (see `layout-breakpoints.ts`), so a shell resting on a boundary
 * does not flicker between layouts.
 *
 * Note that labels and condensed share the 600 / 640px pair today. The in-between "icons" mode
 * (no labels, not condensed) therefore only exists inside that 40px band, depending on which
 * way the shell was resized.
 *
 * `toolsRef` is the footer's tools row. The width is measured on the closest
 * `[data-prompt-input-shell]` ancestor, so the ref must stay inside `PromptInput`.
 */
export function useCoreInputLayout(toolsRef: RefObject<HTMLElement | null>): CoreInputLayout {
  const showLabelsRef = useRef(false);
  const isCondensedRef = useRef(false);
  const [showLabels, setShowLabels] = useState(false);
  const [isCondensed, setIsCondensed] = useState(false);

  useLayoutEffect(() => {
    const el = toolsRef.current;

    if (!el) return;

    const { showLabelsAtPx, hideLabelsAtPx, condensedAtPx, expandedAtPx } = CORE_INPUT_LAYOUT;

    const applyWidth = (width: number) => {
      // Ignore pre-layout 0 widths so we don't lock into condensed on desktop.
      if (width < 1) return;

      const nextLabels = showLabelsRef.current ? width >= hideLabelsAtPx : width >= showLabelsAtPx;

      if (nextLabels !== showLabelsRef.current) {
        showLabelsRef.current = nextLabels;
        setShowLabels(nextLabels);
      }

      const nextCondensed = isCondensedRef.current ? width < expandedAtPx : width < condensedAtPx;

      if (nextCondensed !== isCondensedRef.current) {
        isCondensedRef.current = nextCondensed;
        setIsCondensed(nextCondensed);
      }
    };

    const measureTarget = (el.closest("[data-prompt-input-shell]") as HTMLElement | null) ?? el;

    applyWidth(measureTarget.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      applyWidth(entries[0]?.contentRect.width ?? 0);
    });

    observer.observe(measureTarget);

    return () => observer.disconnect();
    // A ref object is stable, so this runs once on mount: the tools row never remounts.
  }, [toolsRef]);

  return { showLabels, isCondensed };
}
