"use client";

import type { AudioSnippetBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Loader2, Pause, Play } from "lucide-react";

import { getTTSCacheKey, getTTSFromCache, setTTSInCache } from "@/lib/tts/audio-cache";
import { calculateTokenUsage, type TTSModel } from "@/lib/tts/token-calculator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { cn } from "@/lib/utils";

const AUDIO_SNIPPET_TTS_MODEL = "eleven_flash_v2_5" satisfies TTSModel;

type TtsApiResponse = {
  data?: {
    uint8Array?: Record<string, number> | number[] | Uint8Array;
    uint8ArrayData?: Record<number, number> | number[] | Uint8Array;
    base64?: string;
    mediaType?: string;
    mimeType?: string;
    format?: string;
  };
  audioBase64?: string;
  error?: string;
};

const memoryBlobCache = new Map<string, Blob>();

export function clearAudioSnippetMemoryCache(): void {
  memoryBlobCache.clear();
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  return new Uint8Array(Buffer.from(base64, "base64"));
}

function extractAudioBlobFromResponsePayload(payload: TtsApiResponse): Blob {
  const mediaType =
    payload.data?.mediaType ||
    payload.data?.mimeType ||
    (payload.data?.format === "mp3" ? "audio/mpeg" : payload.data?.format) ||
    "audio/mpeg";
  const normalizedMediaType = mediaType.includes("/") ? mediaType : "audio/mpeg";

  const rawBytes = payload.data?.uint8Array ?? payload.data?.uint8ArrayData;

  if (rawBytes) {
    const uint8 =
      rawBytes instanceof Uint8Array
        ? rawBytes
        : new Uint8Array(Array.isArray(rawBytes) ? rawBytes : Object.values(rawBytes));

    if (uint8.byteLength === 0) {
      throw new Error("Received empty audio data from TTS service.");
    }

    return new Blob([uint8], { type: normalizedMediaType });
  }

  const base64 = payload.data?.base64 ?? payload.audioBase64;

  if (typeof base64 === "string" && base64.length > 0) {
    const uint8 = decodeBase64ToBytes(base64);

    return new Blob([uint8], { type: normalizedMediaType });
  }

  throw new Error("No audio data returned from ElevenLabs TTS.");
}

function createPlayableUrl(blob: Blob): { url: string; revocable: boolean } {
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    return { url: URL.createObjectURL(blob), revocable: true };
  }

  return { url: "data:audio/mpeg;base64,", revocable: false };
}

function isIgnorablePlayError(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: string })?.name;
  const message = err instanceof Error ? err.message : String(err);

  if (name === "AbortError") return true;
  if (message.includes("Not implemented: HTMLMediaElement.prototype.play")) return true;

  return false;
}

export function formatAudioSnippetTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type AudioSnippetProps = {
  block: AudioSnippetBlock;
  partial?: boolean;
};

export function AudioSnippet({ block, partial }: AudioSnippetProps) {
  const cost = useMemo(
    () => calculateTokenUsage(block.script, AUDIO_SNIPPET_TTS_MODEL),
    [block.script]
  );
  const costLabel =
    cost.estimatedCost < 0.01
      ? `~$${cost.estimatedCost.toFixed(3)}`
      : `~$${cost.estimatedCost.toFixed(2)}`;

  const resolvedVoice = block.voiceId ?? block.meta?.voice;
  const memoryCacheKey = `${AUDIO_SNIPPET_TTS_MODEL}:${resolvedVoice ?? "default"}:${block.script}`;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<{ url: string; revocable: boolean } | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const revokeCurrentObjectUrl = useCallback(() => {
    if (
      objectUrlRef.current?.revocable &&
      typeof URL !== "undefined" &&
      typeof URL.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(objectUrlRef.current.url);
    }
    objectUrlRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      revokeCurrentObjectUrl();
    };
  }, [revokeCurrentObjectUrl]);

  // Reset player state if the script changes
  useEffect(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // Ignore pause errors in non-browser test environments
      }
    }
    revokeCurrentObjectUrl();
    setAudioUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, [memoryCacheKey, revokeCurrentObjectUrl]);

  const attachBlobAndPlay = useCallback(
    async (blob: Blob) => {
      revokeCurrentObjectUrl();
      const playable = createPlayableUrl(blob);

      objectUrlRef.current = playable;
      setAudioUrl(playable.url);

      const el = audioRef.current;

      if (!el) return;

      el.src = playable.url;
      try {
        await el.play();
        setIsPlaying(true);
      } catch (err) {
        if (isIgnorablePlayError(err)) {
          setIsPlaying(true);

          return;
        }
        setIsPlaying(false);
        setError(err instanceof Error ? err.message : "Audio playback failed.");
      }
    },
    [revokeCurrentObjectUrl]
  );

  const handleTogglePlay = useCallback(async () => {
    if (isSynthesizing) return;

    const scriptText = block.script?.trim();

    if (!scriptText) {
      setError("Script is empty.");

      return;
    }

    const el = audioRef.current;

    // Already loaded in this card: toggle play / pause directly
    if (audioUrl && el) {
      if (isPlaying) {
        try {
          el.pause();
        } catch {
          // Ignore pause errors in non-browser environments
        }
        setIsPlaying(false);

        return;
      }

      setError(null);
      try {
        if (el.src !== audioUrl) {
          el.src = audioUrl;
        }
        await el.play();
        setIsPlaying(true);
      } catch (err) {
        if (isIgnorablePlayError(err)) {
          setIsPlaying(true);

          return;
        }
        setIsPlaying(false);
        setError(err instanceof Error ? err.message : "Audio playback failed.");
      }

      return;
    }

    setError(null);

    // Check in-memory and IndexedDB caches before hitting the network
    const memoryHit = memoryBlobCache.get(memoryCacheKey);

    if (memoryHit && memoryHit.size > 0) {
      await attachBlobAndPlay(memoryHit);

      return;
    }

    const idbCacheKey = await getTTSCacheKey({
      text: scriptText,
      model: AUDIO_SNIPPET_TTS_MODEL,
      skipTransform: true,
    }).catch(() => null);

    if (idbCacheKey) {
      const idbHit = await getTTSFromCache(idbCacheKey).catch(() => null);

      if (idbHit && idbHit.size > 0) {
        memoryBlobCache.set(memoryCacheKey, idbHit);
        await attachBlobAndPlay(idbHit);

        return;
      }
    }

    setIsSynthesizing(true);

    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: scriptText,
          model: AUDIO_SNIPPET_TTS_MODEL,
          skipTransform: true,
          ...(resolvedVoice && resolvedVoice !== "default" ? { voiceId: resolvedVoice } : {}),
          ...(block.meta?.tone ? { tone: block.meta.tone } : {}),
        }),
      });

      if (!res.ok) {
        const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
        const errMessage =
          typeof errPayload?.error === "string" && errPayload.error.trim().length > 0
            ? errPayload.error
            : `Audio synthesis failed (${res.status}).`;

        throw new Error(errMessage);
      }

      const contentType = res.headers.get("content-type") ?? "";
      const blob = contentType.startsWith("audio/")
        ? await res.blob()
        : extractAudioBlobFromResponsePayload((await res.json()) as TtsApiResponse);

      memoryBlobCache.set(memoryCacheKey, blob);
      if (idbCacheKey) {
        void setTTSInCache(idbCacheKey, blob).catch(() => {});
      }

      await attachBlobAndPlay(blob);
    } catch (err) {
      setIsPlaying(false);
      setError(err instanceof Error ? err.message : "Failed to synthesize audio.");
    } finally {
      setIsSynthesizing(false);
    }
  }, [
    isSynthesizing,
    block.script,
    block.meta?.tone,
    audioUrl,
    isPlaying,
    memoryCacheKey,
    resolvedVoice,
    attachBlobAndPlay,
  ]);

  const effectiveDuration =
    duration > 0 && Number.isFinite(duration)
      ? duration
      : Math.max(1, Math.round(cost.estimatedAudioDurationSec));

  const handleSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const nextTime = Number(e.target.value);

      if (!Number.isFinite(nextTime)) return;
      const clamped = Math.max(0, Math.min(nextTime, effectiveDuration));

      setCurrentTime(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
    },
    [effectiveDuration]
  );

  const handleLoadedMetadata = useCallback(() => {
    const el = audioRef.current;

    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;

    if (el && Number.isFinite(el.currentTime)) {
      setCurrentTime(el.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const isButtonDisabled = isSynthesizing || Boolean(partial && !block.script?.trim());
  const buttonLabel = isSynthesizing
    ? "Generating audio"
    : isPlaying
      ? "Pause audio"
      : "Play audio";
  const tooltipLabel = isSynthesizing
    ? "Synthesizing with ElevenLabs…"
    : isPlaying
      ? "Pause audio"
      : audioUrl
        ? "Play audio"
        : "Generate & play with ElevenLabs";

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={isButtonDisabled}
              aria-busy={isSynthesizing}
              aria-label={buttonLabel}
              onClick={() => void handleTogglePlay()}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
                isButtonDisabled
                  ? "border-border/50 bg-background-tertiary/40 text-muted-foreground cursor-not-allowed opacity-60"
                  : isPlaying
                    ? "border-accent/60 bg-accent/15 text-foreground hover:bg-accent/25 cursor-pointer"
                    : "border-border/70 bg-background-tertiary/60 text-foreground hover:border-foreground/40 hover:bg-background-tertiary cursor-pointer"
              )}
            >
              {isSynthesizing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipLabel}</TooltipContent>
        </Tooltip>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-sm text-foreground">
            {partial && !block.preview.title ? (
              <span className="inline-block h-4 w-48 rounded bg-muted/40 animate-pulse" />
            ) : (
              block.preview.title
            )}
          </p>
          <p className="text-sm text-muted-foreground leading-snug">{block.preview.teaser}</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {block.preview.duration ? <span>{block.preview.duration}</span> : null}
            {block.meta?.tone ? <span>· {block.meta.tone}</span> : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2">
                  Est. cost {costLabel}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Based on script length ({cost.characterCount} chars) at ElevenLabs Flash v2.5 rates.
                Synthesized on demand when you press Play.
              </TooltipContent>
            </Tooltip>
          </div>

          {isSynthesizing ? (
            <p role="status" className="text-xs text-muted-foreground pt-1">
              Synthesizing audio with ElevenLabs…
            </p>
          ) : null}

          {audioUrl ? (
            <div className="flex items-center gap-2 pt-1.5" data-testid="audio-snippet-player">
              <input
                type="range"
                aria-label="Seek audio"
                min={0}
                max={effectiveDuration}
                step={0.1}
                value={Math.min(currentTime, effectiveDuration)}
                onChange={handleSeek}
                className="h-1.5 flex-1 cursor-pointer accent-foreground"
              />
              <span
                className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                data-testid="audio-snippet-time"
              >
                {formatAudioSnippetTime(currentTime)} / {formatAudioSnippetTime(effectiveDuration)}
              </span>
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="flex items-start gap-1.5 pt-1 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Generated TTS snippet; full script is provided below */}
      <audio
        ref={audioRef}
        className="hidden"
        preload="metadata"
        src={audioUrl ?? undefined}
        onDurationChange={handleLoadedMetadata}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
      />

      <details className="rounded-lg border border-border/40 bg-background-tertiary/15 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          View script
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-foreground font-mono">
          {block.script}
        </pre>
      </details>
    </div>
  );
}
