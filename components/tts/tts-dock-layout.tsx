"use client";

import type { ReactNode } from "react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function ttsDockAudioSurfaceClass(show: boolean) {
  return cn(
    "box-border bg-transparent",
    show ? "h-auto min-h-0 w-[min(100vw-4rem,28rem)] max-w-full shrink" : "h-px w-px min-h-0"
  );
}

type TTSDockLayoutProps = {
  show: boolean;
  /** Page shell: docked to bottom of `relative` column. Inline: centered block for demos. */
  variant: "pageBottom" | "inline";
  /** Native `<audio>` (streaming ref or static `src`). */
  audio: ReactNode;
  trailing?: ReactNode;
};

/**
 * Shared glass chrome for the TTS dock — used by global {@link TTSDockBar} and the showcase static player.
 */
export function TTSDockLayout({ show, variant, audio, trailing }: TTSDockLayoutProps) {
  const outer =
    variant === "pageBottom"
      ? cn(
          !show
            ? "sr-only"
            : "absolute inset-x-0 bottom-0 z-200 flex justify-center px-2 pt-0.5 pb-[max(0.125rem,env(safe-area-inset-bottom))]"
        )
      : cn("flex w-full justify-center py-1", !show && "sr-only");

  return (
    <div className={outer}>
      <div
        className={cn(
          "flex items-center gap-2",
          show
            ? cn(
                glass({ border: "none" }),
                "w-fit max-w-[min(100%,40rem)] rounded-xl border border-white/10 px-2 py-0.5 shadow-md"
              )
            : "contents"
        )}
      >
        {audio}
        {show ? trailing : null}
      </div>
    </div>
  );
}
