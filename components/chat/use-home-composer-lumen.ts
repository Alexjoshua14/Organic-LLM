"use client";

/**
 * Homepage composer lumen rim — same band ratios as capability chips
 * (see use-composer-chip-lumen.ts), measured against the prompt input shell.
 */

import type { RefObject } from "react";

import { useLumenRim, useLumenRimHostRef } from "@coalescence-labs/design/lumen";

export function useHomeComposerLumenHostRef() {
  return useLumenRimHostRef();
}

export function useHomeComposerLumen(hostRef: RefObject<HTMLSpanElement | null>, enabled = true) {
  // Sized from the shell's resting height, so a composer that grows while you type keeps its glow.
  useLumenRim(hostRef, {
    target: "[data-prompt-input-shell]",
    radius: "shell",
    enabled,
    holdRestingHeight: true,
  });
}
