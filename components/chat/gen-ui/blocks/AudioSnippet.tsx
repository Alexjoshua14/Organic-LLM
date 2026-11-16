"use client";

import type { AudioSnippetBlock } from "@/lib/schemas/gen-ui";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Copy, Loader2, Pause, Play } from "lucide-react";

import { formatAudioSnippetTime } from "./audio-progress";
import { buildAudioSnippetMetaItems } from "./audio-snippet-meta";
import { AudioSeekBar } from "./AudioSeekBar";

import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { spacing } from "@/lib/design-tokens/spacing";
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

export { formatAudioSnippetTime };

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

const META_CONTROL_CLASS =
  "rounded-sm text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-2 motion-reduce:transition-none";

type AudioSnippetProps = {
  block: AudioSnippetBlock;
  partial?: boolean;
};

export function AudioSnippet({ block, partial }: AudioSnippetProps) {
  const scriptPanelId = useId();
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
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  const metaItems = useMemo(
    () =>
      buildAudioSnippetMetaItems({
        duration: block.preview.duration,
        tone: block.meta?.tone,
        costLabel,
      }),
    [block.preview.duration, block.meta?.tone, costLabel]
  );

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
    setDuration(0);
    setError(null);
    setScriptOpen(false);
    setScriptCopied(false);
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

  const handleLoadedMetadata = useCallback(() => {
    const el = audioRef.current;

    if (el && Number.isFinite(el.duration) && el.duration > 0) {
      setDuration(el.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleCopyScript = useCallback(async () => {
    const ok = await copyTextToClipboard(block.script);

    if (!ok) return;
    setScriptCopied(true);
    window.setTimeout(() => setScriptCopied(false), 1600);
  }, [block.script]);

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
    <div className={spacing.card.chrome}>
      <div className="flex items-start gap-inline-md">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={isButtonDisabled}
              aria-busy={isSynthesizing}
              aria-label={buttonLabel}
              onClick={() => void handleTogglePlay()}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:border-foreground focus-visible:bg-foreground focus-visible:text-background",
                isButtonDisabled
                  ? "border-border/50 bg-background-tertiary/40 text-muted-foreground cursor-not-allowed opacity-60"
                  : isPlaying
                    ? "border-accent/60 bg-accent/15 text-foreground hover:bg-accent/25 cursor-pointer"
                    : "border-border/70 bg-background-tertiary/60 text-foreground hover:border-foreground/40 hover:bg-background-tertiary cursor-pointer"
              )}
            >
              {isSynthesizing ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              ) : isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipLabel}</TooltipContent>
        </Tooltip>

        <div className={cn("min-w-0 flex-1", spacing.card.labelStack)}>
          <p className="font-medium text-sm text-foreground">
            {partial && !block.preview.title ? (
              <span className="inline-block h-4 w-48 rounded bg-muted/40 animate-pulse motion-reduce:animate-none" />
            ) : (
              block.preview.title
            )}
          </p>
          <p className="text-sm text-muted-foreground leading-snug">{block.preview.teaser}</p>

          <div
            className={cn(
              "flex flex-wrap items-center gap-y-stack-xs text-[11px] text-muted-foreground",
              spacing.gap.sm
            )}
          >
            {metaItems.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-inline-sm whitespace-nowrap"
              >
                <span className={item.tabularNums ? "tabular-nums" : undefined}>{item.label}</span>
                {/* Trailing sep keeps · off the next line start when the row wraps. */}
                <span aria-hidden="true">·</span>
              </span>
            ))}
            <button
              type="button"
              className={cn(META_CONTROL_CLASS, "whitespace-nowrap")}
              aria-expanded={scriptOpen}
              aria-controls={scriptPanelId}
              onClick={() => setScriptOpen((open) => !open)}
            >
              Script
            </button>
          </div>

          {isSynthesizing ? (
            <p role="status" className="text-xs text-muted-foreground pt-stack-xs">
              Synthesizing audio with ElevenLabs…
            </p>
          ) : null}

          {audioUrl ? (
            <AudioSeekBar
              audioRef={audioRef}
              isPlaying={isPlaying}
              effectiveDuration={effectiveDuration}
              resetKey={memoryCacheKey}
            />
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-inline-sm pt-stack-xs text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          {scriptOpen ? (
            <div id={scriptPanelId} className={cn("pt-stack-sm", spacing.card.labelStack)}>
              <div className="flex items-center justify-between gap-inline-sm">
                <p className="text-[11px] text-muted-foreground">Transcript</p>
                <button
                  type="button"
                  className={cn(META_CONTROL_CLASS, "inline-flex items-center gap-1")}
                  aria-label={scriptCopied ? "Script copied" : "Copy script"}
                  onClick={() => void handleCopyScript()}
                >
                  {scriptCopied ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <Copy className="size-3" aria-hidden />
                  )}
                  {scriptCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto overscroll-contain">
                <p className="max-w-prose whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                  {block.script}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Generated TTS snippet; full script is provided in the Script panel */}
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
      />
    </div>
  );
}
