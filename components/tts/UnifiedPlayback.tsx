"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SkipBack,
  SkipForward,
  Volume2,
  Download,
} from "lucide-react";

import { TextSegment } from "./SegmentManager";
import { formatAudioDuration } from "@/lib/tts/token-calculator";
import { glass } from "@/components/design-system/primitives";

type UnifiedPlaybackProps = {
  segments: TextSegment[];
  onDownload: () => void;
  className?: string;
};

export function UnifiedPlayback({
  segments,
  onDownload,
  className = "",
}: UnifiedPlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

  const generatedIndices = useMemo(() => {
    const idxs: number[] = [];
    segments.forEach((s, idx) => {
      if (s.status === "generated" && s.audioUrl) idxs.push(idx);
    });
    return idxs;
  }, [segments]);

  const generatedPosition = useMemo(() => {
    const pos = generatedIndices.indexOf(currentSegmentIndex);
    return pos === -1 ? 0 : pos;
  }, [generatedIndices, currentSegmentIndex]);

  // Keep selection valid as segments change
  useEffect(() => {
    if (segments.length === 0) return;
    if (currentSegmentIndex >= segments.length) {
      setCurrentSegmentIndex(0);
      return;
    }
    if (generatedIndices.length > 0 && !generatedIndices.includes(currentSegmentIndex)) {
      setCurrentSegmentIndex(generatedIndices[0]);
    }
  }, [segments, generatedIndices, currentSegmentIndex]);

  const currentSegment = segments[currentSegmentIndex];

  const hasCurrentAudio = Boolean(currentSegment?.audioUrl && currentSegment.status === "generated");

  const goToGenerated = (nextPos: number) => {
    if (generatedIndices.length === 0) return;
    const clamped = Math.max(0, Math.min(nextPos, generatedIndices.length - 1));
    setCurrentSegmentIndex(generatedIndices[clamped]);
  };

  const skipToNext = () => goToGenerated(generatedPosition + 1);
  const skipToPrevious = () => goToGenerated(generatedPosition - 1);

  // Auto-advance on end
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const handler = () => {
      if (generatedIndices.length > 0 && generatedPosition < generatedIndices.length - 1) {
        goToGenerated(generatedPosition + 1);
        // allow the src to update before playing
        setTimeout(() => audioRef.current?.play().catch(() => {}), 0);
      }
    };
    el.addEventListener("ended", handler);
    return () => el.removeEventListener("ended", handler);
  }, [generatedIndices, generatedPosition]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
          <Volume2 className="w-4 h-4" />
          <span>
            {generatedIndices.length > 0
              ? `Clip ${generatedPosition + 1} of ${generatedIndices.length}`
              : "No audio generated yet"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={skipToPrevious}
            disabled={generatedPosition === 0}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Previous clip"
          >
            <SkipBack className="w-4.5 h-4.5 text-foreground/70" />
          </button>
          <button
            onClick={skipToNext}
            disabled={generatedIndices.length === 0 || generatedPosition === generatedIndices.length - 1}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Next clip"
          >
            <SkipForward className="w-4.5 h-4.5 text-foreground/70" />
          </button>
          <button
            onClick={onDownload}
            disabled={generatedIndices.length === 0}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Download"
          >
            <Download className="w-4.5 h-4.5 text-foreground/70" />
          </button>
        </div>
      </div>

      <audio
        ref={audioRef}
        controls
        className={`${glass()} rounded-2xl p-2 w-full border border-white/10 ${hasCurrentAudio ? "" : "opacity-50"}`}
        src={hasCurrentAudio ? currentSegment.audioUrl ?? undefined : undefined}
      >
        <track kind="captions" />
      </audio>

      {currentSegment ? (
        <div className="text-xs text-muted-foreground/60 leading-relaxed">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-foreground/70">
              Segment {currentSegmentIndex + 1} • {hasCurrentAudio ? "Ready" : "Not generated"}
            </div>
            <div className="tabular-nums">
              {formatAudioDuration(
                (currentSegment.processedText || currentSegment.originalText).length / 14,
              )}
            </div>
          </div>
          <div className="mt-2 whitespace-pre-wrap line-clamp-3">
            {currentSegment.processedText || currentSegment.originalText}
          </div>
        </div>
      ) : null}
    </div>
  );
}
