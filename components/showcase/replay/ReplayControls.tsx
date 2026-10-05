"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";

import { useShowcasePlaybackMode } from "./showcase-playback-context";
import { REPLAY_HOTKEY_HINT, useReplayHotkeys } from "./use-replay-hotkeys";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

export type ReplayChapterPill = {
  id: string;
  title: string;
};

type ReplayControlsProps = {
  chapters: readonly ReplayChapterPill[];
  chapterIndex: number;
  caption: string;
  playing: boolean;
  progress: number;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSeekChapter: (index: number) => void;
  /** Page-level Space / R / ← → / 1–9 shortcuts. Default on, except inside a narrated page. */
  hotkeys?: boolean;
  /**
   * Reduced motion: the replay shows settled chapter states, so play/pause becomes
   * previous/next stepping. Pass the clock's `reduceMotion`.
   */
  reduceMotion?: boolean;
  /** Identifies the replay as scripted. `null` hides the badge. */
  label?: string | null;
  className?: string;
};

export function ReplayControls({
  chapters,
  chapterIndex,
  caption,
  playing,
  progress,
  onPlay,
  onPause,
  onRestart,
  onSeekChapter,
  hotkeys: hotkeysProp,
  reduceMotion = false,
  label = "Scripted demo",
  className,
}: ReplayControlsProps) {
  const standalone = useShowcasePlaybackMode() === "standalone";
  const hotkeys = hotkeysProp ?? standalone;
  const lastIndex = chapters.length - 1;

  useReplayHotkeys(
    {
      onTogglePlay: () => {
        if (reduceMotion) onSeekChapter(chapterIndex >= lastIndex ? 0 : chapterIndex + 1);
        else if (playing) onPause();
        else onPlay();
      },
      onRestart,
      onSeekChapter,
      chapterIndex,
      chapterCount: chapters.length,
    },
    hotkeys
  );

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 p-3 shadow-sm sm:p-4",
        glass({ border: "none" }),
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {reduceMotion ? (
          <>
            <Button
              aria-label="Previous chapter"
              disabled={chapterIndex <= 0}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => onSeekChapter(chapterIndex - 1)}
            >
              <ChevronLeft className="size-3.5" />
              <span className="ml-1.5">Back</span>
            </Button>
            <Button
              aria-label="Next chapter"
              disabled={chapterIndex >= lastIndex}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => onSeekChapter(chapterIndex + 1)}
            >
              <span className="mr-1.5">Next</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </>
        ) : (
          <Button
            aria-keyshortcuts="Space"
            aria-label={playing ? "Pause replay" : "Play replay"}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => (playing ? onPause() : onPlay())}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            <span className="ml-1.5">{playing ? "Pause" : "Play"}</span>
          </Button>
        )}
        <Button
          aria-keyshortcuts="R"
          aria-label="Restart replay"
          size="sm"
          type="button"
          variant="ghost"
          onClick={onRestart}
        >
          <RotateCcw className="size-3.5" />
          <span className="ml-1.5">Restart</span>
        </Button>
        <div aria-label="Chapters" className="ml-auto flex flex-wrap gap-1.5" role="group">
          {chapters.map((chapter, index) => {
            const active = index === chapterIndex;

            return (
              <button
                key={chapter.id}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  active
                    ? "border-amber-400/50 bg-amber-400/15 text-foreground"
                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                )}
                type="button"
                onClick={() => onSeekChapter(index)}
              >
                {index + 1}. {chapter.title}
              </button>
            );
          })}
        </div>
      </div>

      <div aria-hidden className="mb-2 h-1 overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full rounded-full bg-linear-to-r from-amber-400/80 to-sky-400/70 transition-[width] duration-100 ease-linear motion-reduce:transition-none"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <p
          aria-live="polite"
          className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground"
        >
          {caption}
        </p>
        {label ? (
          <span className="shrink-0 rounded-full border border-border/50 bg-background-tertiary/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>

      {reduceMotion ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">
          Reduced motion is on — each chapter shows its finished state.
        </p>
      ) : null}
      {hotkeys ? (
        <p className="mt-1.5 hidden text-[10px] text-muted-foreground/60 sm:block">
          <span className="sr-only">Keyboard shortcuts: </span>
          {REPLAY_HOTKEY_HINT}
        </p>
      ) : null}
    </div>
  );
}
