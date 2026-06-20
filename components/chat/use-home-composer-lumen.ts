"use client";

/**
 * Homepage composer lumen rim — same band ratios as capability chips
 * (see use-composer-chip-lumen.ts), measured against the prompt input shell.
 */

import { useLayoutEffect, useRef, type RefObject } from "react";

const LUMEN_INSET_RATIO = 0.03;
const LUMEN_OUTSET_RATIO = 0.1;
const LUMEN_BLUR_RATIO = 0.11;

export function useHomeComposerLumenHostRef() {
  return useRef<HTMLSpanElement>(null);
}

export function useHomeComposerLumen(hostRef: RefObject<HTMLSpanElement | null>) {
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const sync = () => {
      const shell = host.querySelector<HTMLElement>("[data-prompt-input-shell]");
      if (!shell) return;

      const { width, height } = shell.getBoundingClientRect();
      if (width < 1 || height < 1) return;

      const min = Math.min(width, height);
      const inset = min * LUMEN_INSET_RATIO;
      const outset = min * LUMEN_OUTSET_RATIO;
      const blur = min * LUMEN_BLUR_RATIO;

      host.style.setProperty("--composer-radius", getComputedStyle(shell).borderRadius);
      host.style.setProperty("--lumen-inset", `${inset}px`);
      host.style.setProperty("--lumen-outset", `${outset}px`);
      host.style.setProperty("--lumen-band", `${inset + outset}px`);
      host.style.setProperty("--lumen-blur", `${blur}px`);
      host.style.setProperty("--lumen-bleed", `${outset + blur}px`);
    };

    sync();

    const shell = host.querySelector<HTMLElement>("[data-prompt-input-shell]");
    if (!shell) return;

    const observer = new ResizeObserver(sync);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [hostRef]);
}
