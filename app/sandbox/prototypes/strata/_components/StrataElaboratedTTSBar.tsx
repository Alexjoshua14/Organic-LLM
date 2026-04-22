"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Volume2 } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import {
  clampTtsPlainText,
  estimateStrataElaboratedTtsDurations,
  formatTtsDurationLabel,
  markdownToTtsPlainText,
  mergeStrataElaboratedTtsSlotIntoContentJson,
  parseStrataElaboratedTtsFull,
  parseStrataElaboratedTtsSummary,
  sha256HexUtf8,
  type StrataElaboratedTtsPayload,
} from "@/lib/strata/elaborated-tts";
import { ELEVENLABS_V3_SPEECH_MODEL_ID } from "@/lib/tts/elevenlabs-v3-speech";

type TtsApiResponse = {
  data: {
    uint8Array?: Record<string, number>;
    uint8ArrayData?: Record<number, number>;
    mediaType?: string;
    format?: string;
  };
};

function uint8FromResponsePayload(raw: Record<string, number> | Record<number, number>): Uint8Array {
  return new Uint8Array(Object.values(raw));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return globalThis.btoa(binary);
}

async function fetchTtsAudioBytes(
  ttsText: string,
  options?: { model?: string }
): Promise<{ bytes: Uint8Array; mediaType: string }> {
  const res = await fetch("/api/ai/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: ttsText,
      ...(options?.model ? { model: options.model } : {}),
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = typeof errBody?.error === "string" ? errBody.error : "Speech generation failed.";
    throw new Error(msg);
  }

  const body = (await res.json()) as TtsApiResponse;
  const raw = body.data?.uint8Array ?? body.data?.uint8ArrayData;
  if (!raw) throw new Error("No audio data in response.");

  const bytes = uint8FromResponsePayload(raw);
  const mediaType = body.data.mediaType || body.data.format || "audio/mpeg";
  return { bytes, mediaType };
}

function useElaboratedTtsPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => revokeObjectUrl();
  }, [revokeObjectUrl]);

  const ensurePlayableSrc = useCallback(
    (tts: StrataElaboratedTtsPayload) => {
      revokeObjectUrl();
      const el = audioRef.current;
      if (!el) return;

      if (tts.remoteUrl) {
        el.src = tts.remoteUrl;
        return;
      }
      if (tts.audioBase64) {
        const bytes = Uint8Array.from(globalThis.atob(tts.audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: tts.mediaType || "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        el.src = url;
      }
    },
    [revokeObjectUrl]
  );

  return { audioRef, ensurePlayableSrc, revokeObjectUrl };
}

export function StrataElaboratedSummaryTTSBar(props: {
  markdown: string;
  contentJson: Record<string, unknown> | null;
  onPersist: (nextContentJson: Record<string, unknown> | null) => Promise<void>;
  disabled?: boolean;
  pageId?: string;
}) {
  const { markdown, contentJson, onPersist, disabled, pageId } = props;
  const stored = useMemo(() => parseStrataElaboratedTtsSummary(contentJson), [contentJson]);
  const { audioRef, ensurePlayableSrc } = useElaboratedTtsPlayback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [actualPlaybackSeconds, setActualPlaybackSeconds] = useState<number | null>(null);

  const elaboratedPlain = useMemo(() => markdownToTtsPlainText(markdown), [markdown]);
  const scriptPreview = stored?.ttsPlainText ?? null;
  const { estimatedPlaybackSeconds, estimatedGenerationSeconds } = useMemo(
    () => estimateStrataElaboratedTtsDurations(scriptPreview ?? ""),
    [scriptPreview]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!elaboratedPlain) {
        if (!cancelled) setFingerprint(null);
        return;
      }
      const fp = await sha256HexUtf8(elaboratedPlain);
      if (!cancelled) setFingerprint(fp);
    })();
    return () => {
      cancelled = true;
    };
  }, [elaboratedPlain]);

  const isStale = Boolean(stored && fingerprint && stored.sourceContentSha256 !== fingerprint);

  useEffect(() => {
    if (!stored) return;
    ensurePlayableSrc(stored);
  }, [stored, ensurePlayableSrc]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    if (!elaboratedPlain) {
      setError("Nothing to summarize yet.");
      return;
    }
    setBusy(true);
    setActualPlaybackSeconds(null);
    try {
      const sourceContentSha256 = await sha256HexUtf8(elaboratedPlain);

      const sumRes = await fetch("/api/prototypes/strata/elaborated-speech-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elaboratedMarkdown: markdown,
          pageId,
          ttsModel: ELEVENLABS_V3_SPEECH_MODEL_ID,
        }),
      });
      if (!sumRes.ok) {
        const errBody = await sumRes.json().catch(() => ({}));
        const msg =
          typeof errBody?.error === "string" ? errBody.error : "Failed to generate summary script.";
        throw new Error(`Summary: ${msg}`);
      }
      const sumJson = (await sumRes.json()) as { script?: string };
      const rawScript = typeof sumJson.script === "string" ? sumJson.script : "";
      if (!rawScript.trim()) {
        throw new Error("Summary: empty script returned.");
      }

      const { text: ttsText, truncated } = clampTtsPlainText(rawScript);
      const { bytes, mediaType } = await fetchTtsAudioBytes(ttsText, {
        model: ELEVENLABS_V3_SPEECH_MODEL_ID,
      }).catch((e) => {
        throw new Error(e instanceof Error ? `Speech: ${e.message}` : "Speech: generation failed.");
      });
      const audioBase64 = bytesToBase64(bytes);

      const payload: StrataElaboratedTtsPayload = {
        version: 1,
        mediaType: typeof mediaType === "string" && mediaType.includes("/") ? mediaType : "audio/mpeg",
        audioBase64,
        generatedAt: new Date().toISOString(),
        sourceContentSha256,
        ttsInputWasTruncated: truncated || undefined,
        ttsPlainText: ttsText,
      };

      const nextJson = mergeStrataElaboratedTtsSlotIntoContentJson(contentJson, "summary", payload);
      await onPersist(nextJson);
      ensurePlayableSrc(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }, [elaboratedPlain, markdown, contentJson, onPersist, ensurePlayableSrc, pageId]);

  const canGenerate = elaboratedPlain.length > 0 && !disabled;

  const handleAudioLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el?.duration || !Number.isFinite(el.duration)) {
      setActualPlaybackSeconds(null);
      return;
    }
    setActualPlaybackSeconds(el.duration);
  }, []);

  const timingLabel = useMemo(() => {
    if (busy) {
      const gen =
        estimatedGenerationSeconds != null ? formatTtsDurationLabel(estimatedGenerationSeconds) : null;
      return gen ? `Generating summary audio… (speech est. ~${gen})` : "Generating summary audio…";
    }
    if (actualPlaybackSeconds != null && Number.isFinite(actualPlaybackSeconds)) {
      const label = formatTtsDurationLabel(actualPlaybackSeconds);
      return label ? `Playback: ${label}` : null;
    }
    if (stored && !busy) {
      return "Playback: calculating…";
    }
    if (
      canGenerate &&
      estimatedPlaybackSeconds != null &&
      estimatedGenerationSeconds != null &&
      scriptPreview
    ) {
      const p = formatTtsDurationLabel(estimatedPlaybackSeconds);
      const g = formatTtsDurationLabel(estimatedGenerationSeconds);
      if (p && g) return `Est. before regenerate: ~${g} to synthesize · ~${p} listening`;
    }
    if (canGenerate && !stored) {
      return "Typical listening length ~20–30s (short summary, not verbatim).";
    }
    return null;
  }, [
    busy,
    stored,
    canGenerate,
    scriptPreview,
    actualPlaybackSeconds,
    estimatedPlaybackSeconds,
    estimatedGenerationSeconds,
  ]);

  return (
    <div
      className={cn(
        glass({ opaque: false }),
        "mb-3 flex flex-col gap-2 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">
          {stored && !isStale
            ? "Summary audio is saved with this page (spoken overview, not a verbatim reading)."
            : stored && isStale
              ? "Elaborated text changed since this summary audio was made. Regenerate to match."
              : "Generates a short spoken summary (~25s) of the elaborated section—not a verbatim reading."}
        </p>
        {timingLabel ? (
          <p className="text-[11px] text-muted-foreground truncate" title={timingLabel}>
            {timingLabel}
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          className="h-9 min-w-[9rem]"
          color="primary"
          isDisabled={!canGenerate || busy}
          isLoading={busy}
          size="sm"
          startContent={busy ? undefined : <Volume2 className="h-4 w-4" />}
          variant="flat"
          onPress={() => void handleGenerate()}
        >
          {stored && !isStale ? "Regenerate" : stored && isStale ? "Regenerate" : "Generate audio"}
        </Button>
        <audio
          ref={audioRef}
          controls
          className="h-9 max-w-[min(100%,220px)]"
          preload="metadata"
          onLoadedMetadata={handleAudioLoadedMetadata}
        />
      </div>
    </div>
  );
}

export function StrataElaboratedVerbatimTTSBar(props: {
  markdown: string;
  contentJson: Record<string, unknown> | null;
  onPersist: (nextContentJson: Record<string, unknown> | null) => Promise<void>;
  disabled?: boolean;
}) {
  const { markdown, contentJson, onPersist, disabled } = props;
  const stored = useMemo(() => parseStrataElaboratedTtsFull(contentJson), [contentJson]);
  const { audioRef, ensurePlayableSrc } = useElaboratedTtsPlayback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [actualPlaybackSeconds, setActualPlaybackSeconds] = useState<number | null>(null);

  const elaboratedPlain = useMemo(() => markdownToTtsPlainText(markdown), [markdown]);
  const ttsBasis = useMemo(() => clampTtsPlainText(elaboratedPlain), [elaboratedPlain]);
  const { estimatedPlaybackSeconds, estimatedGenerationSeconds } = useMemo(
    () => estimateStrataElaboratedTtsDurations(ttsBasis.text),
    [ttsBasis.text]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!elaboratedPlain) {
        if (!cancelled) setFingerprint(null);
        return;
      }
      const fp = await sha256HexUtf8(elaboratedPlain);
      if (!cancelled) setFingerprint(fp);
    })();
    return () => {
      cancelled = true;
    };
  }, [elaboratedPlain]);

  const isStale = Boolean(stored && fingerprint && stored.sourceContentSha256 !== fingerprint);

  useEffect(() => {
    if (!stored) return;
    ensurePlayableSrc(stored);
  }, [stored, ensurePlayableSrc]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    if (!elaboratedPlain) {
      setError("Nothing to read aloud yet.");
      return;
    }
    setBusy(true);
    setActualPlaybackSeconds(null);
    try {
      const sourceContentSha256 = await sha256HexUtf8(elaboratedPlain);
      const { text: ttsText, truncated } = clampTtsPlainText(elaboratedPlain);

      const { bytes, mediaType } = await fetchTtsAudioBytes(ttsText);
      const audioBase64 = bytesToBase64(bytes);

      const payload: StrataElaboratedTtsPayload = {
        version: 1,
        mediaType: typeof mediaType === "string" && mediaType.includes("/") ? mediaType : "audio/mpeg",
        audioBase64,
        generatedAt: new Date().toISOString(),
        sourceContentSha256,
        ttsInputWasTruncated: truncated || undefined,
        ttsPlainText: ttsText,
      };

      const nextJson = mergeStrataElaboratedTtsSlotIntoContentJson(contentJson, "full", payload);
      await onPersist(nextJson);
      ensurePlayableSrc(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speech generation failed.");
    } finally {
      setBusy(false);
    }
  }, [elaboratedPlain, contentJson, onPersist, ensurePlayableSrc]);

  const canGenerate = elaboratedPlain.length > 0 && !disabled;
  const showAudio = Boolean(stored && !isStale);

  const handleAudioLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el?.duration || !Number.isFinite(el.duration)) {
      setActualPlaybackSeconds(null);
      return;
    }
    setActualPlaybackSeconds(el.duration);
  }, []);

  const timingLabel = useMemo(() => {
    if (busy) {
      const gen =
        estimatedGenerationSeconds != null ? formatTtsDurationLabel(estimatedGenerationSeconds) : null;
      return gen ? `Generating narration… (est. ~${gen})` : "Generating narration…";
    }
    if (actualPlaybackSeconds != null && Number.isFinite(actualPlaybackSeconds)) {
      const label = formatTtsDurationLabel(actualPlaybackSeconds);
      return label ? `Playback: ${label}` : null;
    }
    if (stored && !busy && showAudio) {
      return "Playback: calculating…";
    }
    if (
      canGenerate &&
      estimatedPlaybackSeconds != null &&
      estimatedGenerationSeconds != null &&
      !stored
    ) {
      const p = formatTtsDurationLabel(estimatedPlaybackSeconds);
      const g = formatTtsDurationLabel(estimatedGenerationSeconds);
      if (p && g) return `Est. before generate: ~${g} to synthesize · ~${p} listening`;
    }
    return null;
  }, [
    busy,
    stored,
    showAudio,
    canGenerate,
    actualPlaybackSeconds,
    estimatedPlaybackSeconds,
    estimatedGenerationSeconds,
  ]);

  return (
    <div
      className={cn(
        glass({ opaque: false }),
        "mb-4 max-w-md flex flex-col gap-2 self-start rounded-lg border border-border/50 p-2.5 sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">
          {stored && !isStale
            ? "Verbatim audio saved (first segment of elaborated text)."
            : stored && isStale
              ? "Text changed since this verbatim audio was made."
              : "Verbatim audio from elaborated text (may truncate if very long)."}
        </p>
        {timingLabel ? (
          <p className="text-[11px] text-muted-foreground truncate" title={timingLabel}>
            {timingLabel}
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          className="h-9 min-w-[7.5rem]"
          color="default"
          isDisabled={!canGenerate || busy}
          isLoading={busy}
          size="sm"
          startContent={busy ? undefined : <Volume2 className="h-4 w-4" />}
          variant="flat"
          onPress={() => void handleGenerate()}
        >
          {stored && !isStale ? "Regenerate" : stored && isStale ? "Regenerate" : "Generate audio"}
        </Button>
        {showAudio ? (
          <audio
            ref={audioRef}
            controls
            className="h-9 max-w-[min(100%,200px)]"
            preload="metadata"
            onLoadedMetadata={handleAudioLoadedMetadata}
          />
        ) : null}
      </div>
    </div>
  );
}
