"use client";

import { useEffect, useRef } from "react";

import { useVoiceSessionOptional } from "./voice-session-provider";

/**
 * The live bar's home on routes without a composer.
 *
 * A viewport-tall layer at the top of the layout's `<main>` that takes no space (`h-dvh` cancelled
 * by `-mb-[100dvh]`). It spans `<main>`'s width, so the bar centres on the page area and never
 * slides under the sidebar; its bottom is the visible bottom even when `<main>`'s content is
 * taller than the screen. Must stay `<main>`'s first flow child. CoreInput's drawer slot takes
 * precedence while it is mounted.
 */
export function VoiceLiveBarPageAnchor() {
  const session = useVoiceSessionOptional();
  const ref = useRef<HTMLDivElement | null>(null);
  const setBarPageAnchor = session?.setBarPageAnchor;

  useEffect(() => {
    if (!setBarPageAnchor) return;

    setBarPageAnchor(ref.current);

    return () => setBarPageAnchor(null);
  }, [setBarPageAnchor]);

  return (
    <div className="pointer-events-none relative z-40 -mb-[100dvh] h-dvh w-full">
      <div
        ref={ref}
        className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] mx-auto flex w-full max-w-2xl justify-center px-4"
        data-voice-bar-page-anchor=""
      />
    </div>
  );
}
