"use client";

import type { SpeakStageStatusKind } from "@/lib/speak/speak-stage-view";

import { useEffect, useRef } from "react";

import {
  SPEAK_ORB_HALO_GAIN,
  SPEAK_ORB_LEVEL_SMOOTHING,
  SPEAK_ORB_STATE_MS,
  SPEAK_ORB_VOLUME_GAIN,
} from "./speak-stage-timing";

import { useVoiceAudioLevels } from "@/hooks/use-voice-audio-levels";
import { cn } from "@/lib/utils";

/**
 * State → hue and resting presence. Hues are accents that read on both themes; the halo's
 * opacity, not its colour, carries how "awake" the orb is.
 */
const ORB_STATE: Record<SpeakStageStatusKind, { hue: string; rest: number; halo: number }> = {
  ready: { hue: "oklch(0.7 0.12 255)", rest: 0.9, halo: 0.18 },
  connecting: { hue: "oklch(0.7 0.12 255)", rest: 0.94, halo: 0.28 },
  listening: { hue: "oklch(0.72 0.15 230)", rest: 1, halo: 0.34 },
  thinking: { hue: "oklch(0.68 0.17 295)", rest: 1.02, halo: 0.4 },
  speaking: { hue: "oklch(0.72 0.17 330)", rest: 1.04, halo: 0.42 },
  muted: { hue: "oklch(0.62 0.03 260)", rest: 0.94, halo: 0.14 },
  paused: { hue: "oklch(0.75 0.11 75)", rest: 0.9, halo: 0.2 },
  error: { hue: "oklch(0.65 0.18 25)", rest: 0.9, halo: 0.22 },
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type SpeakOrbProps = {
  status: SpeakStageStatusKind;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  size?: number;
  className?: string;
};

/**
 * The presence orb, driven by the call's real audio.
 *
 * One rAF loop reads the analyser and writes `transform` / `opacity` straight to two layers —
 * compositor-only, no React state, no re-render. The loop runs only while there is a live
 * stream, the tab is visible, and motion is allowed; otherwise the orb rests at its state's
 * scale and the steady state costs zero frames.
 */
export function SpeakOrb({
  status,
  localStream,
  remoteStream,
  size = 208,
  className,
}: SpeakOrbProps) {
  const readLevels = useVoiceAudioLevels({ local: localStream, remote: remoteStream });
  const coreRef = useRef<HTMLDivElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const levelRef = useRef(0);
  const config = ORB_STATE[status];
  const hasAudio = Boolean(localStream || remoteStream);

  useEffect(() => {
    const core = coreRef.current;
    const halo = haloRef.current;

    const rest = () => {
      levelRef.current = 0;
      if (core) core.style.transform = `scale(${config.rest})`;
      if (halo) halo.style.opacity = String(config.halo);
    };

    if (!hasAudio || prefersReducedMotion()) {
      rest();

      return;
    }

    let raf = 0;

    const frame = () => {
      const { volume } = readLevels();
      // Speech RMS rarely passes ~0.35; stretch it so normal talking uses the range.
      const target = Math.min(1, volume * 2.6);

      levelRef.current += (target - levelRef.current) * SPEAK_ORB_LEVEL_SMOOTHING;

      const level = levelRef.current;

      if (core) {
        core.style.transform = `scale(${(config.rest + level * SPEAK_ORB_VOLUME_GAIN).toFixed(4)})`;
      }
      if (halo) {
        halo.style.opacity = Math.min(1, config.halo + level * SPEAK_ORB_HALO_GAIN).toFixed(3);
      }

      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        rest();
      } else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [config.halo, config.rest, hasAudio, readLevels]);

  const transition = `background-color ${SPEAK_ORB_STATE_MS}ms ease, box-shadow ${SPEAK_ORB_STATE_MS}ms ease`;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative select-none", className)}
      data-state={status}
      style={{ width: size, height: size, ["--orb-hue" as string]: config.hue }}
    >
      {/* Halo: wide, soft, the part that breathes with volume. */}
      <div
        ref={haloRef}
        className="absolute inset-[-18%] rounded-full blur-3xl motion-reduce:transition-none"
        style={{
          backgroundColor: "var(--orb-hue)",
          opacity: config.halo,
          transition: hasAudio ? transition : `${transition}, opacity ${SPEAK_ORB_STATE_MS}ms ease`,
        }}
      />
      {/* Core: a lit glass sphere. Scale follows the voice. */}
      <div
        ref={coreRef}
        className="absolute inset-[14%] rounded-full will-change-transform"
        style={{
          transform: `scale(${config.rest})`,
          background:
            "radial-gradient(circle at 34% 28%, color-mix(in oklch, white 70%, var(--orb-hue)) 0%, var(--orb-hue) 42%, color-mix(in oklch, var(--orb-hue) 55%, black) 100%)",
          boxShadow:
            "inset 0 -10px 28px color-mix(in oklch, var(--orb-hue) 40%, black), 0 0 60px color-mix(in oklch, var(--orb-hue) 45%, transparent)",
          transition: `${transition}, transform ${hasAudio ? 0 : SPEAK_ORB_STATE_MS}ms ease`,
        }}
      />
      {/* Connecting / thinking: a slow ring so waiting never looks frozen. */}
      {status === "connecting" || status === "thinking" ? (
        <div
          className="absolute inset-[8%] animate-spin rounded-full border border-transparent motion-reduce:animate-none"
          style={{
            borderTopColor: "var(--orb-hue)",
            borderRightColor: "color-mix(in oklch, var(--orb-hue) 40%, transparent)",
            animationDuration: status === "connecting" ? "1.1s" : "2.4s",
          }}
        />
      ) : null}
    </div>
  );
}
