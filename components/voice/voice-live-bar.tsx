"use client";

import { PhoneOff } from "lucide-react";

import { VoiceElapsed } from "./voice-elapsed";
import { VoiceFluidGlass } from "./voice-fluid-glass";
import { VOICE_BAR_HEIGHT_PX } from "./voice-live-bar-timing";
import { VoiceWaveform } from "./voice-waveform";

import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type VoiceLiveBarProps = {
  phase: "idle" | "listening" | "thinking" | "speaking";
  connecting: boolean;
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
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
 * Material is two layers: `glassPreview` provides the real page blur via `backdrop-filter`, and
 * `VoiceFluidGlass` sits on top adding the 3D transmission that CSS cannot express. See
 * `voice-fluid-glass.tsx` for why it has to be both.
 */
export function VoiceLiveBar({
  phase,
  connecting,
  startedAt,
  localStream,
  remoteStream,
  onEnd,
}: VoiceLiveBarProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        glassPreview({ depth: "floating", border: "all" }),
        "pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-t-xl px-3"
      )}
      data-voice-live-bar=""
      role="status"
      style={{ height: VOICE_BAR_HEIGHT_PX }}
    >
      <VoiceFluidGlass />

      {/* Screen-reader summary; the waveform and glow carry this visually. */}
      <span className="sr-only">
        {connecting ? "Connecting voice session" : `${PHASE_LABEL[phase]} — voice session active`}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          "relative size-1.5 shrink-0 rounded-full transition-colors duration-300",
          connecting ? "bg-muted-foreground" : "bg-lumen",
          phase === "speaking" && "bg-accent"
        )}
      />

      {/*
        `self-stretch` is load-bearing: the SVG sizes itself with `h-full`, which is indefinite
        against an auto-height flex child and collapses the ribbon. Stretching to the bar's fixed
        height gives that percentage something to resolve against.
      */}
      <div className="relative min-w-0 flex-1 self-stretch text-foreground/70">
        <VoiceWaveform
          localStream={localStream}
          paused={connecting}
          remoteStream={remoteStream}
        />
      </div>

      {startedAt !== null ? (
        <VoiceElapsed className="relative shrink-0 text-2xs" startedAt={startedAt} />
      ) : null}

      <button
        aria-label="End voice session"
        className="relative shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-rose-400"
        title="End voice session"
        type="button"
        onClick={onEnd}
      >
        <PhoneOff className="size-3.5" />
      </button>
    </div>
  );
}
