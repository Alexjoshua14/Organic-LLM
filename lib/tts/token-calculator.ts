/**
 * Token Calculator for TTS Models
 * Estimates token usage, costs, and generation time for various TTS providers
 *
 * Pricing updated: January 2026
 */

export type TTSModel =
  | "gpt-4o-mini-tts"
  | "eleven_multilingual_v2"
  | "eleven_flash_v2_5"
  | "eleven_v3";

export type TokenUsageData = {
  characterCount: number;
  estimatedTokens: number;
  estimatedCost: number;
  costPerUnit: number;
  currency: string;
  model: TTSModel;
  provider: string;
  estimatedDurationMs: number; // Estimated generation time
  estimatedAudioDurationSec: number; // Estimated audio length
};

// Pricing data (as of January 2026, in USD)
// Sources: OpenAI API pricing, ElevenLabs pricing page
const PRICING_CONFIG: Record<
  TTSModel,
  {
    costPerMillionChars: number;
    provider: string;
    displayName: string;
    charsPerSecondGeneration: number; // How fast it generates (chars processed per second)
    charsPerSecondAudio: number; // Average speaking rate (chars per second of audio)
    tier: "budget" | "standard" | "premium";
  }
> = {
  "gpt-4o-mini-tts": {
    costPerMillionChars: 12, // $0.012 per 1000 characters (reduced in 2026)
    provider: "OpenAI",
    displayName: "GPT-4o Mini TTS",
    charsPerSecondGeneration: 800, // Fast generation
    charsPerSecondAudio: 15, // ~15 chars/sec speaking rate
    tier: "budget",
  },
  eleven_multilingual_v2: {
    costPerMillionChars: 180, // $0.18 per 1000 characters (Creator tier)
    provider: "ElevenLabs",
    displayName: "Multilingual v2",
    charsPerSecondGeneration: 400, // Medium speed
    charsPerSecondAudio: 14,
    tier: "standard",
  },
  eleven_flash_v2_5: {
    costPerMillionChars: 80, // $0.08 per 1000 characters (Flash - optimized for speed)
    provider: "ElevenLabs",
    displayName: "Flash v2.5",
    charsPerSecondGeneration: 1200, // Very fast (optimized)
    charsPerSecondAudio: 15,
    tier: "budget",
  },
  eleven_v3: {
    costPerMillionChars: 300, // $0.30 per 1000 characters (Premium quality)
    provider: "ElevenLabs",
    displayName: "v3 (Premium)",
    charsPerSecondGeneration: 300, // Slower, higher quality
    charsPerSecondAudio: 13,
    tier: "premium",
  },
};

// Preview/placeholder audio is extremely cheap
export const PREVIEW_COST_PER_CHAR = 0.000001; // Negligible cost for skip notices

/**
 * Calculate token usage, cost, and time estimates for given text and model
 */
export function calculateTokenUsage(text: string, model: TTSModel): TokenUsageData {
  const characterCount = text.length;
  const estimatedTokens = characterCount;

  const config = PRICING_CONFIG[model];
  const estimatedCost = (characterCount / 1_000_000) * config.costPerMillionChars;

  // Estimate generation time (processing time on server)
  const estimatedDurationMs = Math.ceil((characterCount / config.charsPerSecondGeneration) * 1000);

  // Estimate resulting audio duration
  const estimatedAudioDurationSec = characterCount / config.charsPerSecondAudio;

  return {
    characterCount,
    estimatedTokens,
    estimatedCost,
    costPerUnit: config.costPerMillionChars,
    currency: "USD",
    model,
    provider: config.provider,
    estimatedDurationMs,
    estimatedAudioDurationSec,
  };
}

/**
 * Calculate cost for multiple segments with different generation statuses
 */
export function calculateSegmentedCost(
  segments: Array<{ text: string; status: "generate" | "skip" | "preview" }>,
  model: TTSModel
): {
  totalCost: number;
  generatedCost: number;
  previewCost: number;
  totalDurationMs: number;
  totalAudioDurationSec: number;
  breakdown: Array<{
    index: number;
    cost: number;
    durationMs: number;
    audioDurationSec: number;
  }>;
} {
  const config = PRICING_CONFIG[model];
  let totalCost = 0;
  let generatedCost = 0;
  let previewCost = 0;
  let totalDurationMs = 0;
  let totalAudioDurationSec = 0;
  const breakdown: Array<{
    index: number;
    cost: number;
    durationMs: number;
    audioDurationSec: number;
  }> = [];

  segments.forEach((segment, index) => {
    const charCount = segment.text.length;
    let cost = 0;
    let durationMs = 0;
    const audioDurationSec = charCount / config.charsPerSecondAudio;

    if (segment.status === "generate") {
      cost = (charCount / 1_000_000) * config.costPerMillionChars;
      durationMs = Math.ceil((charCount / config.charsPerSecondGeneration) * 1000);
      generatedCost += cost;
    } else if (segment.status === "preview") {
      // Preview uses cheap placeholder audio
      cost = charCount * PREVIEW_COST_PER_CHAR;
      durationMs = 500; // Quick generation for placeholder
      previewCost += cost;
    }
    // "skip" status = no cost, but still takes audio time

    totalCost += cost;
    totalDurationMs += durationMs;
    totalAudioDurationSec += audioDurationSec;

    breakdown.push({ index, cost, durationMs, audioDurationSec });
  });

  return {
    totalCost,
    generatedCost,
    previewCost,
    totalDurationMs,
    totalAudioDurationSec,
    breakdown,
  };
}

/**
 * Format cost for display (handles very small numbers gracefully)
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.0001) return "~$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;

  return `$${cost.toFixed(2)}`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return "<1s";
  const seconds = Math.ceil(ms / 1000);

  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) return `~${minutes}m`;

  return `~${minutes}m ${remainingSeconds}s`;
}

/**
 * Format audio duration for display
 */
export function formatAudioDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Format number with commas for readability
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get model display info
 */
export function getModelInfo(model: TTSModel) {
  return PRICING_CONFIG[model];
}

/**
 * Split text into segments (by paragraph or sentence)
 */
export function splitTextIntoSegments(
  text: string,
  mode: "paragraph" | "sentence" = "paragraph"
): string[] {
  if (mode === "paragraph") {
    // Split by double newlines or single newlines with significant content
    return text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  } else {
    // Split by sentences (rough heuristic)
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}

/**
 * Generate placeholder text for skipped audio section
 */
export function generateSkipPlaceholderText(segmentIndex: number, originalText: string): string {
  const wordCount = originalText.split(/\s+/).length;

  return `Section ${segmentIndex + 1} skipped. ${wordCount} words not generated.`;
}
