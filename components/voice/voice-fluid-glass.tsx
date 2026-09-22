"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

import { VOICE_GLASS_FADE_MS } from "./voice-live-bar-timing";

import { cn } from "@/lib/utils";

// Keep Three out of the initial app bundle. The bar shows its CSS fallback until this is ready,
// so starting a voice session never waits for the renderer.
const FluidGlassCanvas = dynamic(() => import("./voice-fluid-glass-canvas"), { ssr: false });

export type FluidGlassStatus = "loading" | "ready" | "failed";

class GlassBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Three r163+ is WebGL2-only; without it the canvas would mount and silently draw nothing. */
function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

export type VoiceFluidGlassProps = {
  className?: string;
  /** Reported so the bar can hold its CSS fallback until the glass has actually drawn. */
  onStatusChange?: (status: FluidGlassStatus) => void;
};

/**
 * ReactBits' FluidGlass bar, fitted to the voice drawer. It refracts the page's real LiquidChrome
 * background by re-rendering it offscreen — see `voice-fluid-glass-canvas.tsx`. It is the bar's
 * only material once ready; the CSS glass is strictly a loading and failure fallback.
 */
export function VoiceFluidGlass({ className, onStatusChange }: VoiceFluidGlassProps) {
  const [paused, setPaused] = useState(true);
  const [status, setStatus] = useState<FluidGlassStatus>("loading");
  const onStatusChangeRef = useRef(onStatusChange);

  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    onStatusChangeRef.current?.(status);
  }, [status]);

  useEffect(() => {
    if (!supportsWebGL2()) {
      setStatus("failed");

      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPaused(reduced.matches || document.hidden);

    sync();
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const markReady = useCallback(() => setStatus((s) => (s === "failed" ? s : "ready")), []);
  const markFailed = useCallback(() => setStatus("failed"), []);

  if (status === "failed") return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity motion-reduce:transition-none",
        status === "ready" ? "opacity-100" : "opacity-0",
        className
      )}
      data-voice-fluid-glass={status}
      style={{ transitionDuration: `${VOICE_GLASS_FADE_MS}ms` }}
    >
      <GlassBoundary onError={markFailed}>
        <FluidGlassCanvas paused={paused} onContextLost={markFailed} onReady={markReady} />
      </GlassBoundary>
    </div>
  );
}
