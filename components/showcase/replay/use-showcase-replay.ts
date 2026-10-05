"use client";

import { useCallback, useState, type RefObject } from "react";

import { useShowcasePlaybackMode } from "./showcase-playback-context";
import { useReplayClock, type ReplayClock } from "./use-replay-clock";

export type UseShowcaseReplayOptions = {
  durationMs: number;
  /** Chapter openings — seek-and-play lands here. */
  chapterStarts: readonly number[];
  /** Chapter finished states — reduced-motion stepping lands here. */
  chapterSettledTimes: readonly number[];
  stageRef: RefObject<Element | null>;
  /**
   * Default false: play once, then hold the final state so visitors can inspect and
   * interact. Pass true for a passive ambient loop (Ergon).
   */
  loop?: boolean;
  autoplay?: boolean;
  initialTimeMs?: number;
};

export type ShowcaseReplay = ReplayClock & {
  /** 0 → 1 across the whole replay. */
  progress: number;
  /**
   * Increments on restart, chapter seek, and replay-from-end. Key interactive overrides
   * and stateful production components on it so the script starts from a clean slate.
   */
  resetKey: number;
  seekChapter: (index: number) => void;
  /**
   * The visitor touched a demo control: pause and leave the scripted state for them.
   * Render their override until `resetKey` changes.
   */
  takeover: () => void;
};

/**
 * Replay clock plus the chapter semantics every showcase stage shares: seek-and-play
 * normally, step between settled states under reduced motion, and reset visitor overrides
 * whenever the script is rewound.
 */
export function useShowcaseReplay({
  durationMs,
  chapterStarts,
  chapterSettledTimes,
  stageRef,
  loop = false,
  autoplay = true,
  initialTimeMs = 0,
}: UseShowcaseReplayOptions): ShowcaseReplay {
  const narrated = useShowcasePlaybackMode() === "narrated";
  const clock = useReplayClock({
    durationMs,
    stageRef,
    loop,
    autoplay: narrated || autoplay,
    initialTimeMs: narrated ? 0 : initialTimeMs,
  });
  const [resetKey, setResetKey] = useState(0);
  const bump = useCallback(() => setResetKey((k) => k + 1), []);
  const { play: clockPlay, pause, seek, reduceMotion, tMs } = clock;

  const seekChapter = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, chapterStarts.length - 1));

      bump();
      if (reduceMotion) {
        seek(chapterSettledTimes[clamped] ?? durationMs);
        pause();

        return;
      }
      seek(chapterStarts[clamped] ?? 0);
      clockPlay();
    },
    [bump, chapterSettledTimes, chapterStarts, clockPlay, durationMs, pause, reduceMotion, seek]
  );

  const restart = useCallback(() => {
    if (reduceMotion) {
      seekChapter(0);

      return;
    }
    bump();
    clock.restart();
  }, [bump, clock, reduceMotion, seekChapter]);

  const play = useCallback(() => {
    if (reduceMotion) return;
    if (tMs >= durationMs) bump();
    clockPlay();
  }, [bump, clockPlay, durationMs, reduceMotion, tMs]);

  return {
    ...clock,
    play,
    restart,
    seekChapter,
    takeover: pause,
    resetKey,
    progress: durationMs > 0 ? Math.min(1, tMs / durationMs) : 0,
  };
}
