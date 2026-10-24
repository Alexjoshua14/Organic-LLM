"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

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
  className,
}: ReplayControlsProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 p-3 shadow-sm sm:p-4",
        glass({ border: "none" }),
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          aria-label={playing ? "Pause replay" : "Play replay"}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => (playing ? onPause() : onPlay())}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          <span className="ml-1.5">{playing ? "Pause" : "Play"}</span>
        </Button>
        <Button
          aria-label="Restart replay"
          size="sm"
          type="button"
          variant="ghost"
          onClick={onRestart}
        >
          <RotateCcw className="size-3.5" />
          <span className="ml-1.5">Restart</span>
        </Button>
        <div className="ml-auto flex flex-wrap gap-1.5">
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
          className="h-full rounded-full bg-linear-to-r from-amber-400/80 to-sky-400/70 transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}
