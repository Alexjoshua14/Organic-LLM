"use client";

import { useEffect, useState } from "react";

import { VoiceFluidGlass, type FluidGlassStatus } from "./voice-fluid-glass";
import { VOICE_GLASS_FADE_MS } from "./voice-live-bar-timing";

import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type VoiceBarSurfaceProps = {
  /** Lab toggle. Off shows exactly what a device without WebGL2 sees. */
  glass?: boolean;
};

/**
 * The bar's background: FluidGlass, and nothing else.
 *
 * The CSS glass is never layered under the 3D glass — two materials stacked read as neither. It
 * exists only while FluidGlass is loading or if it cannot run (no WebGL2, context loss, a thrown
 * renderer). The bar must never be transparent: it is the only thing on screen saying the mic is
 * open. Once the glass has drawn its first frame it fades in over the fallback, and the fallback
 * unmounts so its `backdrop-filter` stops costing anything.
 */
export function VoiceBarSurface({ glass = true }: VoiceBarSurfaceProps) {
  const [status, setStatus] = useState<FluidGlassStatus>("loading");
  const [fallbackMounted, setFallbackMounted] = useState(true);
  const ready = glass && status === "ready";

  useEffect(() => {
    if (!ready) {
      setFallbackMounted(true);

      return;
    }

    // Held until the glass's fade-in completes, so nothing uncovers mid-crossfade.
    const timer = window.setTimeout(() => setFallbackMounted(false), VOICE_GLASS_FADE_MS);

    return () => window.clearTimeout(timer);
  }, [ready]);

  return (
    <>
      {fallbackMounted ? (
        <div
          aria-hidden="true"
          className={cn(
            glassPreview({ depth: "floating", border: "all" }),
            "pointer-events-none absolute inset-0 rounded-[inherit]"
          )}
          data-voice-bar-fallback=""
        />
      ) : null}
      {glass ? <VoiceFluidGlass onStatusChange={setStatus} /> : null}
    </>
  );
}
