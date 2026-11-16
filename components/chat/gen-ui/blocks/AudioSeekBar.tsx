"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type RefObject,
} from "react";

import {
  clampAudioTime,
  formatAudioSnippetTime,
  interpolateAudioProgress,
  type AudioProgressSample,
} from "./audio-progress";

import { cn } from "@/lib/utils";

type AudioSeekBarProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  effectiveDuration: number;
  /** Clears progress when the synthesised source or script identity changes. */
  resetKey: string;
};

type AudioTimeLabelProps = {
  currentTime: number;
  duration: number;
};

function AudioTimeLabel({ currentTime, duration }: AudioTimeLabelProps) {
  return (
    <span
      className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
      data-testid="audio-snippet-time"
    >
      {formatAudioSnippetTime(currentTime)} / {formatAudioSnippetTime(duration)}
    </span>
  );
}

const MemoAudioTimeLabel = memo(AudioTimeLabel, (prev, next) => {
  return (
    Math.floor(prev.currentTime) === Math.floor(next.currentTime) &&
    Math.floor(prev.duration) === Math.floor(next.duration)
  );
});

function readSample(el: HTMLAudioElement, playing: boolean): AudioProgressSample {
  const mediaTime = Number.isFinite(el.currentTime) ? el.currentTime : 0;
  const playbackRate =
    Number.isFinite(el.playbackRate) && el.playbackRate > 0 ? el.playbackRate : 1;

  return {
    mediaTime,
    wallTimeMs: performance.now(),
    playbackRate,
    playing: playing && !el.paused && !el.ended,
  };
}

export function AudioSeekBar({
  audioRef,
  isPlaying,
  effectiveDuration,
  resetKey,
}: AudioSeekBarProps) {
  const [displayTime, setDisplayTime] = useState(0);
  const sampleRef = useRef<AudioProgressSample>({
    mediaTime: 0,
    wallTimeMs: 0,
    playbackRate: 1,
    playing: false,
  });
  const scrubbingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const displayTimeRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const applyDisplayTime = useCallback((next: number) => {
    displayTimeRef.current = next;
    setDisplayTime(next);
  }, []);

  const resyncFromElement = useCallback(
    (playingOverride?: boolean) => {
      const el = audioRef.current;

      if (!el) return;

      const elementPlaying = !el.paused && !el.ended;
      const playing =
        typeof playingOverride === "boolean" ? playingOverride && elementPlaying : elementPlaying;

      sampleRef.current = readSample(el, playing);
      if (!scrubbingRef.current) {
        applyDisplayTime(clampAudioTime(sampleRef.current.mediaTime, effectiveDuration));
      }
    },
    [audioRef, applyDisplayTime, effectiveDuration]
  );

  const tick = useCallback(() => {
    rafRef.current = null;
    if (scrubbingRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const el = audioRef.current;
    const sample = sampleRef.current;

    if (!el || el.paused || el.ended || !sample.playing) return;

    // Re-anchor when the element clock moves (quantised updates / seeks).
    const mediaTime = Number.isFinite(el.currentTime) ? el.currentTime : sample.mediaTime;

    if (mediaTime !== sample.mediaTime) {
      sampleRef.current = readSample(el, true);
    }

    const next = interpolateAudioProgress(sampleRef.current, performance.now(), effectiveDuration);

    if (next !== displayTimeRef.current) {
      applyDisplayTime(next);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [audioRef, applyDisplayTime, effectiveDuration]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // Reset when the synthesised source / script identity changes.
  useEffect(() => {
    stopLoop();
    scrubbingRef.current = false;
    sampleRef.current = {
      mediaTime: 0,
      wallTimeMs: performance.now(),
      playbackRate: 1,
      playing: false,
    };
    applyDisplayTime(0);
  }, [resetKey, applyDisplayTime, stopLoop]);

  // Attach media listeners for resync points.
  useEffect(() => {
    const el = audioRef.current;

    if (!el) return;

    const onSync = () => {
      resyncFromElement();
    };
    const onPlay = () => {
      resyncFromElement(true);
      startLoop();
    };
    const onPause = () => {
      resyncFromElement(false);
      stopLoop();
    };
    const onEnded = () => {
      sampleRef.current = {
        mediaTime: 0,
        wallTimeMs: performance.now(),
        playbackRate: 1,
        playing: false,
      };
      applyDisplayTime(0);
      stopLoop();
    };

    el.addEventListener("timeupdate", onSync);
    el.addEventListener("seeking", onSync);
    el.addEventListener("seeked", onSync);
    el.addEventListener("loadedmetadata", onSync);
    el.addEventListener("durationchange", onSync);
    el.addEventListener("ended", onEnded);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);

    return () => {
      el.removeEventListener("timeupdate", onSync);
      el.removeEventListener("seeking", onSync);
      el.removeEventListener("seeked", onSync);
      el.removeEventListener("loadedmetadata", onSync);
      el.removeEventListener("durationchange", onSync);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
    };
  }, [audioRef, applyDisplayTime, resyncFromElement, startLoop, stopLoop, resetKey]);

  // Drive / stop the rAF loop from playing state + tab visibility.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopLoop();
        resyncFromElement(false);

        return;
      }
      if (isPlaying) {
        resyncFromElement(true);
        startLoop();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    if (isPlaying) {
      resyncFromElement(true);
      startLoop();
    } else {
      resyncFromElement(false);
      stopLoop();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopLoop();
    };
  }, [isPlaying, resyncFromElement, startLoop, stopLoop]);

  const beginScrub = useCallback(() => {
    scrubbingRef.current = true;
    stopLoop();
  }, [stopLoop]);

  const endScrub = useCallback(() => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    const el = audioRef.current;

    if (el && isPlaying && !el.paused && !el.ended) {
      sampleRef.current = readSample(el, true);
      startLoop();
    } else {
      resyncFromElement(false);
    }
  }, [audioRef, isPlaying, resyncFromElement, startLoop]);

  const handleSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const nextTime = Number(e.target.value);

      if (!Number.isFinite(nextTime)) return;
      const clamped = clampAudioTime(nextTime, effectiveDuration);

      applyDisplayTime(clamped);
      sampleRef.current = {
        mediaTime: clamped,
        wallTimeMs: performance.now(),
        playbackRate: audioRef.current?.playbackRate || 1,
        playing: false,
      };
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
    },
    [audioRef, applyDisplayTime, effectiveDuration]
  );

  const progressPct =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (displayTime / effectiveDuration) * 100)) : 0;

  return (
    <div className="flex items-center gap-inline-sm pt-stack-xs" data-testid="audio-snippet-player">
      <input
        type="range"
        aria-label="Seek audio"
        min={0}
        max={effectiveDuration}
        step="any"
        value={Math.min(displayTime, effectiveDuration)}
        onChange={handleSeek}
        onPointerDown={beginScrub}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={(event) => {
          if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown" ||
            event.key === "Home" ||
            event.key === "End" ||
            event.key === "PageUp" ||
            event.key === "PageDown"
          ) {
            beginScrub();
          }
        }}
        onKeyUp={endScrub}
        onBlur={endScrub}
        style={{ "--audio-seek-progress": `${progressPct}%` } as CSSProperties}
        className={cn(
          "audio-snippet-seek h-1.5 flex-1 cursor-pointer appearance-none rounded-full",
          "bg-[linear-gradient(to_right,var(--foreground)_var(--audio-seek-progress),var(--border)_var(--audio-seek-progress))]",
          "focus-visible:outline-none",
          "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground",
          "[&::-webkit-slider-thumb]:border-0",
          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground",
          "focus-visible:[&::-webkit-slider-thumb]:bg-background",
          "focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--foreground)]",
          "focus-visible:[&::-moz-range-thumb]:bg-background",
          "focus-visible:[&::-moz-range-thumb]:shadow-[0_0_0_2px_var(--foreground)]"
        )}
      />
      <MemoAudioTimeLabel currentTime={displayTime} duration={effectiveDuration} />
    </div>
  );
}
