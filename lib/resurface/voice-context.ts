import type { ResurfaceKind } from "@/lib/resurface/schema";

import { RESURFACE_KIND_LABEL } from "@/lib/resurface/schema";
import { estimateSpeakTokens } from "@/lib/speak/token-limit";

/**
 * The resurfaced thought as the Speak session sees it. Rebuilt from the server cache at mint;
 * nothing here comes from the client.
 */
export type ResurfaceVoiceSeed = {
  kind: ResurfaceKind;
  title: string;
  recap: string;
  sourceText: string;
  related: Array<{ kind: ResurfaceKind; title: string; text: string }>;
  /** Mem0 hits for the thought, only when the session opted into memory. */
  memories: string[];
};

/** Same ceiling as a resumed thread's preamble; instructions are re-read every turn. */
export const RESURFACE_VOICE_CONTEXT_MAX_TOKENS = 1_800;

const RELATED_TEXT_MAX_CHARS = 360;
const MEMORY_TEXT_MAX_CHARS = 240;

/** Every session opened from a card starts with this, so it is also what the tests pin. */
export const RESURFACE_OPENING_DIRECTIVE = `The user tapped a resurfaced thought on their Organic LLM homepage to talk it through by voice. You speak first.

Open with one short, warm greeting, then recap in one or two sentences what this thought is — what it was about and where it was left. End with a light question or an offer to pick it up. Keep the whole opening under about fifteen seconds. Do not read these notes aloud, list sources, or say you were given context; speak as someone who remembers.

After the opening, follow the user's lead. The material below is background, not a script.`;

function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();

  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * Renders the seed for `buildSpeakRealtimeInstructions`. Related items and memories are dropped
 * from the end until the block fits {@link RESURFACE_VOICE_CONTEXT_MAX_TOKENS}; the thought itself
 * always stays.
 */
export function formatResurfaceVoiceContext(
  seed: ResurfaceVoiceSeed,
  maxTokens: number = RESURFACE_VOICE_CONTEXT_MAX_TOKENS
): string {
  const head = [
    RESURFACE_OPENING_DIRECTIVE,
    "",
    `Resurfaced thought (${RESURFACE_KIND_LABEL[seed.kind]}): ${seed.title}`,
    `Recap: ${seed.recap}`,
    seed.sourceText && seed.sourceText !== seed.recap ? `In their words: ${seed.sourceText}` : null,
  ].filter((line): line is string => line !== null);

  const related = seed.related.map(
    (r) =>
      `- ${RESURFACE_KIND_LABEL[r.kind]} "${cut(r.title, 120)}": ${cut(r.text, RELATED_TEXT_MAX_CHARS)}`
  );
  const memories = seed.memories.map((m) => `- ${cut(m, MEMORY_TEXT_MAX_CHARS)}`);

  const render = (r: string[], m: string[]) =>
    [
      ...head,
      ...(r.length > 0 ? ["", "Related from their history:", ...r] : []),
      ...(m.length > 0 ? ["", "What you remember about them that bears on it:", ...m] : []),
    ].join("\n");

  let keptRelated = related;
  let keptMemories = memories;
  let text = render(keptRelated, keptMemories);

  while (estimateSpeakTokens(text) > maxTokens && (keptMemories.length || keptRelated.length)) {
    if (keptMemories.length > 0) keptMemories = keptMemories.slice(0, -1);
    else keptRelated = keptRelated.slice(0, -1);
    text = render(keptRelated, keptMemories);
  }

  return text;
}
