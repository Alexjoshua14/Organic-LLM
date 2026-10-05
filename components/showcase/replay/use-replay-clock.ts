"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "framer-motion";

import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";

export type UseReplayClockOptions = {
  durationMs: number;
  /** When false, clock freezes (e.g. off-screen). Defaults to in-view + page-visible. */
  stageRef: RefObject<Element | null>;
  loop?: boolean;
  /** Start playing immediately when active. Default true. */
  autoplay?: boolean;
  /** Open on a useful settled frame when a demo is meant to be inspected first. */
  initialTimeMs?: number;
};

export type ReplayClock = {
  tMs: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  restart: () => void;
  seek: (tMs: number) => void;
  /** True when prefers-reduced-motion — frame should snap to end. */
  reduceMotion: boolean;
};

/**
 * requestAnimationFrame clock for showcase replays.
 * Runs only when the stage is on-screen and the tab is visible.
 * With reduced motion, jumps to the end and stays paused.
 * A visitor's pause — or a non-looping replay reaching its end — holds the clock: scrolling
 * away and back, or switching tabs, does not resume it. `play`/`restart` release the hold.
 */
export function useReplayClock({
  durationMs,
  stageRef,
  loop = true,
  autoplay = true,
  initialTimeMs = 0,
}: UseReplayClockOptions): ReplayClock {
  const reduceMotion = useReducedMotion() ?? false;
  const pageVisible = usePageVisible();
  const inView = useWelcomeInView(stageRef, { threshold: 0.2 });
  const active = inView && pageVisible && !reduceMotion;

  const initialTime = reduceMotion ? durationMs : Math.max(0, Math.min(initialTimeMs, durationMs));
  const [tMs, setTMs] = useState(initialTime);
  const [playing, setPlaying] = useState(false);

  const playingRef = useRef(false);
  /** Paused by the visitor, or finished without looping — autoplay must not resume. */
  const heldRef = useRef(false);
  const tRef = useRef(initialTime);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameRef.current = null;
  }, []);

  const seek = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, durationMs));

      tRef.current = clamped;
      setTMs(clamped);
    },
    [durationMs]
  );

  /** Stop the clock without recording intent (off-screen, hidden tab). */
  const suspend = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopRaf();
  }, [stopRaf]);

  const pause = useCallback(() => {
    heldRef.current = true;
    suspend();
  }, [suspend]);

  const play = useCallback(() => {
    heldRef.current = false;
    if (reduceMotion) {
      seek(durationMs);

      return;
    }
    if (tRef.current >= durationMs) {
      tRef.current = 0;
      setTMs(0);
    }
    playingRef.current = true;
    setPlaying(true);
  }, [durationMs, reduceMotion, seek]);

  const restart = useCallback(() => {
    heldRef.current = false;
    if (reduceMotion) {
      seek(durationMs);
      pause();

      return;
    }
    seek(0);
    playingRef.current = true;
    setPlaying(true);
  }, [durationMs, pause, reduceMotion, seek]);

  // Reduced motion: snap to end once.
  useEffect(() => {
    if (!reduceMotion) return;
    seek(durationMs);
    pause();
  }, [durationMs, pause, reduceMotion, seek]);

  // Autoplay / freeze when active changes.
  useEffect(() => {
    if (reduceMotion) return;

    if (!active) {
      suspend();

      return;
    }

    if (autoplay && !heldRef.current) {
      play();
    }
  }, [active, autoplay, play, reduceMotion, suspend]);

  // RAF loop.
  useEffect(() => {
    if (!playing || reduceMotion) {
      stopRaf();

      return;
    }

    const tick = (now: number) => {
      if (!playingRef.current) return;

      const last = lastFrameRef.current ?? now;

      lastFrameRef.current = now;
      const delta = Math.min(64, now - last);
      let next = tRef.current + delta;

      if (next >= durationMs) {
        if (loop) {
          next = 0;
        } else {
          next = durationMs;
          tRef.current = next;
          setTMs(next);
          pause();

          return;
        }
      }

      tRef.current = next;
      setTMs(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => stopRaf();
  }, [durationMs, loop, pause, playing, reduceMotion, stopRaf]);

  return {
    tMs,
    playing,
    play,
    pause,
    restart,
    seek,
    reduceMotion,
  };
}
