"use client";

import type { ArcadiaSpeakSessionPhase } from "@/lib/arcadia/multitask/speak-session";

import { Mic, PhoneOff } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  SPEAK_BAR_CROSSFADE_MS,
  SPEAK_BAR_EASE,
  SPEAK_BAR_ENTER_MS,
  SPEAK_BAR_EXIT_MS,
} from "./subagent-speak-bar-timing";

import { VoiceBarSurface } from "@/components/voice/voice-bar-surface";
import { VoiceElapsed } from "@/components/voice/voice-elapsed";
import { VOICE_BAR_HEIGHT_PX } from "@/components/voice/voice-live-bar-timing";
import { VoiceWaveform } from "@/components/voice/voice-waveform";
import { cn } from "@/lib/utils";

type SubagentSpeakGlassBarProps = {
  agentName: string;
  phase: ArcadiaSpeakSessionPhase;
  voicePhase: "idle" | "listening" | "thinking" | "speaking";
  startedAt: number | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  disabled?: boolean;
  onSpeakTo: () => void;
  onEnd: () => void;
};

/**
 * Quiet FluidGlass Speak control that morphs in place into the live voice bar.
 * Same shell for idle → connecting → live; handoff exits this bar faster than the next enters.
 */
export function SubagentSpeakGlassBar({
  agentName,
  phase,
  voicePhase,
  startedAt,
  localStream,
  remoteStream,
  disabled,
  onSpeakTo,
  onEnd,
}: SubagentSpeakGlassBarProps) {
  const reduceMotion = useReducedMotion();
  const active = phase === "connecting" || phase === "live" || phase === "closing";
  const enter = reduceMotion ? 0 : SPEAK_BAR_ENTER_MS / 1000;
  const exit = reduceMotion ? 0 : SPEAK_BAR_EXIT_MS / 1000;
  const cross = reduceMotion ? 0 : SPEAK_BAR_CROSSFADE_MS / 1000;

  return (
    <motion.div
      animate={{
        opacity: phase === "closing" ? 0.55 : 1,
        scale: phase === "closing" && !reduceMotion ? 0.98 : 1,
      }}
      className="relative w-full overflow-hidden rounded-xl"
      data-speak-glass-bar=""
      data-speak-phase={phase}
      style={{ height: VOICE_BAR_HEIGHT_PX }}
      transition={{ duration: exit, ease: SPEAK_BAR_EASE }}
    >
      <VoiceBarSurface />

      <AnimatePresence initial={false} mode="wait">
        {phase === "idle" || phase === "closing" ? (
          <motion.button
            key="idle"
            animate={{ opacity: 1 }}
            className={cn(
              "relative flex size-full items-center justify-center gap-1.5 px-3",
              "text-xs font-medium text-foreground/85",
              "hover:text-foreground transition-colors",
              "disabled:pointer-events-none disabled:opacity-40"
            )}
            disabled={disabled || phase === "closing"}
            exit={{ opacity: 0 }}
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            transition={{ duration: phase === "closing" ? exit : enter, ease: SPEAK_BAR_EASE }}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSpeakTo();
            }}
          >
            <Mic aria-hidden className="size-3.5 opacity-80" />
            <span>Speak to {agentName}</span>
          </motion.button>
        ) : (
          <motion.div
            key="live"
            animate={{ opacity: 1 }}
            aria-live="polite"
            className="relative flex size-full items-center gap-2.5 px-3"
            exit={{ opacity: 0 }}
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            role="status"
            transition={{ duration: cross, ease: SPEAK_BAR_EASE }}
          >
            <span className="sr-only">
              {phase === "connecting"
                ? `Connecting to ${agentName}`
                : `Live voice with ${agentName}`}
            </span>
            <span
              aria-hidden
              className={cn(
                "relative size-1.5 shrink-0 rounded-full transition-colors duration-300",
                phase === "connecting" ? "bg-muted-foreground" : "bg-lumen",
                voicePhase === "speaking" && "bg-accent"
              )}
            />
            <div className="relative min-w-0 flex-1 self-stretch text-foreground/70">
              {active ? (
                <VoiceWaveform
                  localStream={localStream}
                  paused={phase === "connecting"}
                  remoteStream={remoteStream}
                />
              ) : null}
            </div>
            {startedAt !== null && phase === "live" ? (
              <VoiceElapsed className="relative shrink-0 text-2xs" startedAt={startedAt} />
            ) : (
              <span className="relative shrink-0 text-[10px] text-muted-foreground">
                {phase === "connecting" ? "Connecting…" : agentName}
              </span>
            )}
            <button
              aria-label="End voice session"
              className="relative shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-rose-400"
              title="End voice session"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEnd();
              }}
            >
              <PhoneOff className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
