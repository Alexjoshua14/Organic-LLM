"use client";

import { useEffect, useRef } from "react";

import { useVoiceSessionOptional } from "./voice-session-provider";

/**
 * Claims CoreInput as the live bar's home.
 *
 * While this is mounted the bar renders here — a drawer above the composer, its lower edge
 * tucked behind the composer's top so it reads as having slid out from underneath. Unmounting
 * releases the claim and the bar falls back to its fixed anchor, so routes without a composer
 * still show that the mic is open.
 *
 * `bottom-[calc(100%-0.5rem)]` is the tuck: 8px of the bar sits behind the composer's rounded
 * top edge, which is what sells the drawer rather than a floating pill.
 */
export function CoreInputVoiceDrawerSlot({
  includePending = false,
  inline = false,
}: {
  includePending?: boolean;
  /**
   * Sit in flow as a flexible cell of a row (CoreInput's strip, beside the steer tab) instead of
   * floating absolutely above the composer. The bar slides in just the same.
   */
  inline?: boolean;
}) {
  const session = useVoiceSessionOptional();
  const ref = useRef<HTMLDivElement | null>(null);
  const setBarContainer = session?.setBarContainer;

  useEffect(() => {
    if (!setBarContainer) return;

    setBarContainer(ref.current);

    return () => setBarContainer(null);
  }, [setBarContainer]);

  return (
    <div
      ref={ref}
      aria-hidden={
        session?.connected || (includePending && (session?.connecting || session?.paused))
          ? undefined
          : true
      }
      className={
        inline
          ? "pointer-events-none relative flex min-w-0 flex-1 justify-center"
          : "pointer-events-none absolute inset-x-2 bottom-[calc(100%-0.5rem)] z-30 flex justify-center"
      }
    />
  );
}
