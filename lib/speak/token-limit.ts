import { GUARDRAIL_MAX_INPUT_TOKENS } from "@/lib/llm/helpers";

/** Rough heuristic: ~4 characters per token for English prose. */
export const SPEAK_CHARS_PER_TOKEN = 4;

export const SPEAK_MAX_INPUT_TOKENS = GUARDRAIL_MAX_INPUT_TOKENS;

export const SPEAK_MAX_INPUT_CHARS = SPEAK_MAX_INPUT_TOKENS * SPEAK_CHARS_PER_TOKEN;

export function estimateSpeakTokens(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) return 0;

  return Math.ceil(trimmed.length / SPEAK_CHARS_PER_TOKEN);
}

export function validateSpeakInput(text: string): {
  ok: true;
  tokens: number;
  chars: number;
} | {
  ok: false;
  tokens: number;
  chars: number;
  message: string;
} {
  const chars = text.length;
  const tokens = estimateSpeakTokens(text);

  if (tokens > SPEAK_MAX_INPUT_TOKENS) {
    return {
      ok: false,
      tokens,
      chars,
      message: `Text is ~${tokens.toLocaleString()} tokens (limit ${SPEAK_MAX_INPUT_TOKENS.toLocaleString()}). Shorten or split into smaller passages.`,
    };
  }

  return { ok: true, tokens, chars };
}
