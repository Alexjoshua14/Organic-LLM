import z from "zod";

/**
 * Reserved key on `elaborated.contentJson` for app-managed narration.
 * Prefixed to avoid collisions with model-produced `elaboratedArtifacts`.
 */
export const STRATA_ELABORATED_TTS_JSON_KEY = "_strataElaboratedTts";

/** Inline audio for JSONB / local storage; swap for `remoteUrl` when uploading to object storage. */
export const StrataElaboratedTtsPayloadSchema = z
  .object({
    version: z.literal(1),
    mediaType: z.string().min(1),
    audioBase64: z.string().min(1).optional(),
    /** When set, clients should stream from this URL instead of decoding `audioBase64`. */
    remoteUrl: z.string().url().optional(),
    generatedAt: z.string().min(1),
    /** SHA-256 (hex) of normalized plain text derived from elaborated markdown at generation time. */
    sourceContentSha256: z.string().length(64),
    ttsInputWasTruncated: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.audioBase64 || v.remoteUrl), {
    message: "Strata elaborated TTS requires audioBase64 or remoteUrl",
  });

export type StrataElaboratedTtsPayload = z.infer<typeof StrataElaboratedTtsPayloadSchema>;

export const STRATA_ELABORATED_TTS_MAX_CHARS = 4000;

export function markdownToTtsPlainText(markdown: string): string {
  let s = markdown;
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  s = s.replace(/^>\s?/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  s = s.replace(/\|/g, " ");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

export function clampTtsPlainText(
  plain: string,
  max = STRATA_ELABORATED_TTS_MAX_CHARS
): { text: string; truncated: boolean } {
  if (plain.length <= max) return { text: plain, truncated: false };
  return { text: plain.slice(0, max), truncated: true };
}

/** Spoken-word rate for rough listening length (same idea as `RabbitHoleTTSButton`). */
export const STRATA_TTS_EST_PLAYBACK_WORDS_PER_SEC = 2.5;

/** Conservative characters per wall-clock second for typical hosted TTS round-trips. */
const STRATA_TTS_EST_GENERATION_CHARS_PER_SEC = 400;

export function formatTtsDurationLabel(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

/**
 * Estimates from the exact plain string that will be sent to `/api/ai/tts` (after markdown strip + clamp).
 */
export function estimateStrataElaboratedTtsDurations(plainSentToTts: string): {
  estimatedPlaybackSeconds: number | null;
  estimatedGenerationSeconds: number | null;
} {
  const trimmed = plainSentToTts.trim();
  if (!trimmed) {
    return { estimatedPlaybackSeconds: null, estimatedGenerationSeconds: null };
  }
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const estimatedPlaybackSeconds = Math.ceil(words / STRATA_TTS_EST_PLAYBACK_WORDS_PER_SEC);
  const estimatedGenerationSeconds = Math.max(
    2,
    Math.ceil(trimmed.length / STRATA_TTS_EST_GENERATION_CHARS_PER_SEC)
  );
  return { estimatedPlaybackSeconds, estimatedGenerationSeconds };
}

export async function sha256HexUtf8(text: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseStrataElaboratedTts(
  contentJson: Record<string, unknown> | null | undefined
): StrataElaboratedTtsPayload | null {
  if (!contentJson) return null;
  const raw = contentJson[STRATA_ELABORATED_TTS_JSON_KEY];
  if (!raw || typeof raw !== "object") return null;
  const parsed = StrataElaboratedTtsPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function mergeStrataElaboratedTtsIntoContentJson(
  contentJson: Record<string, unknown> | null | undefined,
  payload: StrataElaboratedTtsPayload
): Record<string, unknown> {
  return {
    ...(contentJson ?? {}),
    [STRATA_ELABORATED_TTS_JSON_KEY]: payload,
  };
}

/**
 * After a model run overwrites elaborated, keep only LLM artifacts (drop any prior inline TTS blob).
 */
export function buildElaboratedContentJsonAfterModel(
  artifacts: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!artifacts || Object.keys(artifacts).length === 0) return null;
  const next = { ...artifacts };
  delete next[STRATA_ELABORATED_TTS_JSON_KEY];
  return Object.keys(next).length > 0 ? next : null;
}
