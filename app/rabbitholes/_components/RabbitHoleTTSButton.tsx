"use client";

import { useState, useRef, useCallback, useEffect, useContext, useMemo } from "react";
import { Button } from "@heroui/button";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

import { getAudioForNode, saveAudioForNode } from "../_lib/audioStorage";

import { cn } from "@/lib/utils";
import { RabbitHoleContext } from "@/lib/context/rabbithole-context";
import { createLogger } from "@/lib/logger";

const logger = createLogger("RabbitHoleTTSButton");

interface RabbitHoleTTSButtonProps {
  nodeId: string;
  /** Legacy: single combined text. Ignored when title/summary/content are provided. */
  text?: string;
  title?: string;
  summary?: string;
  content?: string;
  className?: string;
}

/** API returns AI SDK shape: data.uint8Array; legacy shape uses data.uint8ArrayData */
type TTSResponse = {
  data: {
    uint8Array?: Record<string, number>;
    uint8ArrayData?: Record<number, number>;
    mediaType?: string;
    format?: string;
  };
};

function uint8ArrayToBlob(uint8ArrayData: Record<number, number>): Blob {
  const uint8Array = new Uint8Array(Object.values(uint8ArrayData));

  return new Blob([uint8Array], { type: "audio/mpeg" });
}

export function RabbitHoleTTSButton({
  nodeId,
  text: textProp,
  title,
  summary,
  content,
  className,
}: RabbitHoleTTSButtonProps) {
  const segments = useMemo(() => {
    return textProp
      ? [{ section: "full" as const, text: textProp }]
      : (
          [
            { section: "title" as const, text: title },
            { section: "summary" as const, text: summary },
            { section: "content" as const, text: content },
          ].filter((s) => !!s.text) as {
            section: "title" | "summary" | "content";
            text: string;
          }[]
        )
          .map((s) => ({ ...s, text: s.text.trim() }))
          .filter((s) => s.text.length > 0);
  }, [textProp, title, summary, content]);

  const combinedText = useMemo(() => segments.map((s) => s.text).join(".\n"), [segments]);

  const { sessionId } = useContext(RabbitHoleContext);
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string | null>>({});
  const [activeSegmentKey, setActiveSegmentKey] = useState<string | null>(null);
  const segmentIndexRef = useRef<number>(0);
  const audioUrlsRef = useRef<Record<string, string | null>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualDuration, setActualDuration] = useState<number | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playSummary, setPlaySummary] = useState(true);
  const [playContent, setPlayContent] = useState(false);

  // Check for existing audio on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        segments.map(async (s) => {
          const key = `${nodeId}:${s.section}`;
          const url = await getAudioForNode(key);

          return [key, url ?? null] as const;
        })
      );

      if (cancelled) return;

      const next: Record<string, string | null> = {};

      for (const [k, v] of entries) next[k] = v;
      setAudioUrls(next);

      // If we already have at least one segment cached, set it as active for metadata
      const first = segments[0];

      if (first) {
        const firstKey = `${nodeId}:${first.section}`;

        setActiveSegmentKey(firstKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nodeId, segments]);

  audioUrlsRef.current = audioUrls;

  // Estimate duration from text (roughly 2.5 words/sec)
  useEffect(() => {
    const words = combinedText.trim().split(/\s+/).filter(Boolean).length;

    if (words > 0) {
      const estSeconds = Math.ceil(words / 2.5);

      setEstimatedDuration(estSeconds);
    } else {
      setEstimatedDuration(null);
    }
  }, [combinedText]);

  const handlePlay = useCallback(async () => {
    if (segments.length === 0) return;

    // Generate new audio
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      if (!sessionId) {
        logger.error("RabbitHoleTTSButton", "No session ID found");
        setError("No session ID found");

        return;
      }
      // Get audio for each segment, either from storage or generated

      // Check if audio exists
      const existing: Record<string, string> = {};

      for (const s of segments) {
        if (!playSummary && s.section === "summary") continue;
        if (!playContent && s.section === "content") continue;

        const key = `${nodeId}:${s.section}`;
        const existingInState = audioUrlsRef.current[key];

        if (existingInState) {
          existing[key] = existingInState;
          continue;
        }

        // Generate new audio
        const res = await fetch("/api/ai/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: s.text,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to generate speech");
        }

        const data = (await res.json()) as TTSResponse;
        const raw = data.data.uint8Array ?? data.data.uint8ArrayData;

        if (!raw) throw new Error("No audio data in response");
        const uint8Array = new Uint8Array(Object.values(raw));

        const url = await saveAudioForNode(sessionId, key, uint8Array);

        existing[key] = url;
        setAudioUrls((prev) => ({ ...prev, [key]: url }));
      }

      const firstEnabledSegment = segments.find((s) => {
        if (!playSummary && s.section === "summary") return false;
        if (!playContent && s.section === "content") return false;
        const k = `${nodeId}:${s.section}`;

        return existing[k] != null;
      });
      const firstKey = firstEnabledSegment ? `${nodeId}:${firstEnabledSegment.section}` : null;
      const firstUrl = firstKey ? existing[firstKey] : undefined;

      if (!firstUrl || !audioRef.current) return;

      const firstIndex = segments.findIndex((s) => `${nodeId}:${s.section}` === firstKey);

      segmentIndexRef.current = firstIndex >= 0 ? firstIndex : 0;

      setActiveSegmentKey(firstKey);
      audioRef.current.src = firstUrl;
      setIsLoaded(true);
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      const isAborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");

      if (!isAborted) {
        setError(err instanceof Error ? err.message : "Failed to generate audio");
      }
    } finally {
      setLoading(false);
    }
  }, [nodeId, segments, playSummary, playContent, sessionId, loading]);

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    const nextIndex = segmentIndexRef.current + 1;

    if (nextIndex >= segments.length) {
      setIsPlaying(false);

      return;
    }

    segmentIndexRef.current = nextIndex;
    const nextSeg = segments[nextIndex];
    const nextKey = `${nodeId}:${nextSeg.section}`;
    const nextUrl = audioUrlsRef.current[nextKey];

    if (!audioRef.current || !nextUrl) {
      setIsPlaying(false);

      return;
    }

    setActiveSegmentKey(nextKey);
    audioRef.current.src = nextUrl;
    audioRef.current.play().catch((err) => {
      const isAborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");

      if (!isAborted) {
        setError(err instanceof Error ? err.message : "Playback failed");
      }
      setIsPlaying(false);
    });
  }, [nodeId, segments]);

  const handleLoadedMetadata = useCallback(() => {
    setActualDuration(null);
    if (audioRef.current?.duration && isFinite(audioRef.current.duration)) {
      setActualDuration(audioRef.current.duration);
    }
  }, []);

  const formatDuration = (seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);

    if (mins === 0) return `${secs}s`;

    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const totalSegments = segments.length;
  const cachedCount = segments.filter((s) => audioUrls[`${nodeId}:${s.section}`]).length;

  const playbackLabel = loading
    ? totalSegments > 1
      ? `Generating audio... (${cachedCount}/${totalSegments})`
      : "Generating audio..."
    : actualDuration
      ? `Playback: ${formatDuration(actualDuration)}`
      : activeSegmentKey && audioUrls[activeSegmentKey]
        ? "Playback: calculating..."
        : estimatedDuration
          ? `Est. playback: ${formatDuration(estimatedDuration) ?? `${estimatedDuration}s`}`
          : "Tap play to generate audio";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 bg-card/70 border border-border rounded-lg px-3 py-2",
        "shadow-sm",
        className
      )}
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            className="text-muted-foreground hover:text-foreground"
            isDisabled={loading}
            size="sm"
            variant="ghost"
            onPress={isPlaying ? handlePause : handlePlay}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{playbackLabel}</p>
            {error && <p className="text-[11px] text-destructive">{error}</p>}
          </div>
        </div>
        <audio
          ref={audioRef}
          controls
          className={cn("h-8", isLoaded ? "block" : "hidden")}
          preload="metadata"
          src={(activeSegmentKey ? audioUrls[activeSegmentKey] : null) ?? undefined}
          onEnded={handleEnded}
          onLoadedMetadata={handleLoadedMetadata}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      </div>
      {/* <FieldGroup className="flex flex-row items-center gap-4 w-full">
        <Field orientation="horizontal" className="flex items-center gap-2 w-fit">
          <Switch
            checked={playSummary}
            onCheckedChange={setPlaySummary}
            id="summary-switch"
          />
          <FieldLabel htmlFor="summary-switch" className="text-xs">Summary</FieldLabel>
        </Field>
        <Field orientation="horizontal" className="flex items-center gap-2 w-fit">
          <Switch
            checked={playContent}
            onCheckedChange={setPlayContent}
            id="content-switch"
          />
          <FieldLabel htmlFor="content-switch" className="text-xs">Content</FieldLabel>
        </Field>
      </FieldGroup> */}
    </div>
  );
}
