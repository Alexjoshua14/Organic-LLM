"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

const LUMEN_INSET_RATIO = 0.03;
const LUMEN_OUTSET_RATIO = 0.1;
const LUMEN_BLUR_RATIO = 0.11;

export function useChatStyleCardLumenHostRef() {
  return useRef<HTMLSpanElement>(null);
}

/** Sync lumen rim band metrics for Arcadia style picker cards. */
export function useChatStyleCardLumen(
  hostRef: RefObject<HTMLSpanElement | null>,
  enabled: boolean
) {
  useLayoutEffect(() => {
    if (!enabled) return;

    const host = hostRef.current;
    if (!host) return;

    const sync = () => {
      const card = host.querySelector<HTMLElement>(".chat-style-card");
      if (!card) return;

      const { width, height } = card.getBoundingClientRect();
      if (width < 1 || height < 1) return;

      const min = Math.min(width, height);
      const inset = min * LUMEN_INSET_RATIO;
      const outset = min * LUMEN_OUTSET_RATIO;
      const blur = min * LUMEN_BLUR_RATIO;

      host.style.setProperty("--chip-radius", getComputedStyle(card).borderRadius);
      host.style.setProperty("--lumen-inset", `${inset}px`);
      host.style.setProperty("--lumen-outset", `${outset}px`);
      host.style.setProperty("--lumen-band", `${inset + outset}px`);
      host.style.setProperty("--lumen-blur", `${blur}px`);
      host.style.setProperty("--lumen-bleed", `${outset + blur}px`);
    };

    sync();

    const card = host.querySelector<HTMLElement>(".chat-style-card");
    if (!card) return;

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(sync);
    observer.observe(card);
    return () => observer.disconnect();
  }, [enabled, hostRef]);
}
