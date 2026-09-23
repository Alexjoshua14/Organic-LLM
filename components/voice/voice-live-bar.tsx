"use client";

import { Mic, PhoneOff, X } from "lucide-react";

import { VoiceBarSurface } from "./voice-bar-surface";
import { VoiceElapsed } from "./voice-elapsed";
import { VOICE_BAR_HEIGHT_PX } from "./voice-live-bar-timing";
import { VoiceWaveform } from "./voice-waveform";

import { cn } from "@/lib/utils";

export type VoiceLiveBarProps = {
  phase: "idle" | "listening" | "thinking" | "speaking";
  connecting: boolean;
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
  /** The call ended itself after a quiet stretch: mic off, nothing live, `onResume` reconnects. */
  paused?: boolean;
  /** Last resume attempt failed, so the bar should not claim to be merely paused. */
  resumeError?: string | null;
  onResume?: () => void;
};

const PHASE_LABEL: Record<VoiceLiveBarProps["phase"], string> = {
  idle: "Voice is on",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

/**
 * The always-visible proof that a microphone is live.
 *
 * This is the only thing on screen telling the user their mic is open while they are three pages
 * away from `/speak`, so it is never subtle and never dismissible — ending the call is the only
 * way to remove it.
 *
 * **Paused** is the one state where the mic is *not* open: the idle timer ended the call
 * (`lib/speak/voice-idle.ts`). The bar stays so resuming is one tap, but it must not read as live
 * — no waveform, no lumen, no FluidGlass — and it says "mic off" in words.
 *
 * The background is FluidGlass alone, refracting the page's real LiquidChrome behind it; the
 * waveform, clock and controls sit on top. `VoiceBarSurface` holds a CSS glass fallback only while
 * the renderer loads or if it cannot run — see `voice-bar-surface.tsx`.
 */
export function VoiceLiveBar({
  phase,
  connecting,
  startedAt,
  localStream,
  remoteStream,
  onEnd,
  paused = false,
  resumeError = null,
  onResume,
}: VoiceLiveBarProps) {
  // A resume in flight looks like any other connect; paused is only the resting state.
  const resting = paused && !connecting;

  return (
    <div
      aria-live="polite"
      className="pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-t-xl px-3"
      data-voice-live-bar=""
      data-voice-paused={resting ? "" : undefined}
      role="status"
      style={{ height: VOICE_BAR_HEIGHT_PX }}
    >
      {/*
        Paused drops FluidGlass — nothing is live, so its render loop has no reason to run. Keyed
        so resuming remounts it from `loading` instead of trusting a stale `ready` and uncovering
        the bar before the new canvas has drawn.
      */}
      <VoiceBarSurface key={resting ? "paused" : "live"} glass={!resting} />

      {/* Screen-reader summary; the waveform and glow carry this visually. */}
      <span className="sr-only">
        {connecting
          ? "Connecting voice session"
          : resting
            ? "Voice paused — microphone off"
            : `${PHASE_LABEL[phase]} — voice session active`}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "relative size-1.5 shrink-0 rounded-full transition-colors duration-300",
          resting ? "bg-muted-foreground/50" : connecting ? "bg-muted-foreground" : "bg-lumen",
          !resting && phase === "speaking" && "bg-accent"
        )}
      />

      {resting ? (
        <p className="relative min-w-0 flex-1 truncate text-2xs text-muted-foreground">
          {resumeError ? "Couldn’t resume" : "Paused · mic off"}
        </p>
      ) : (
        /*
          `self-stretch` is load-bearing: the SVG sizes itself with `h-full`, which is indefinite
          against an auto-height flex child and collapses the ribbon. Stretching to the bar's
          fixed height gives that percentage something to resolve against.
        */
        <div className="relative min-w-0 flex-1 self-stretch text-foreground/70">
          <VoiceWaveform
            localStream={localStream}
            paused={connecting}
            remoteStream={remoteStream}
          />
        </div>
      )}

      {startedAt !== null && !resting ? (
        <VoiceElapsed className="relative shrink-0 text-2xs" startedAt={startedAt} />
      ) : null}

      {resting ? (
        <button
          aria-label="Resume voice session"
          className="relative flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs text-foreground transition-colors hover:text-lumen"
          title={resumeError ?? "Resume voice session"}
          type="button"
          onClick={onResume}
        >
          <Mic className="size-3.5" />
          Resume
        </button>
      ) : null}

      <button
        aria-label="End voice session"
        className="relative shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-rose-400"
        title="End voice session"
        type="button"
        onClick={onEnd}
      >
        {resting ? <X className="size-3.5" /> : <PhoneOff className="size-3.5" />}
      </button>
    </div>
  );
}
