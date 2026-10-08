/**
 * Card titles must fit two lines at the card's narrowest width. Three layers hold that line:
 * Jev is asked for {@link RESURFACE_TITLE_TARGET_CHARS}, this clamp enforces
 * {@link RESURFACE_TITLE_MAX_CHARS}, and the card itself line-clamps to two lines as the last
 * resort. The arithmetic behind the numbers is in `resurface-card-layout.ts`.
 */
export const RESURFACE_TITLE_TARGET_CHARS = 44;

export const RESURFACE_TITLE_MAX_CHARS = 52;

/** Spoken recap — one or two sentences, read aloud at the top of the call. */
export const RESURFACE_RECAP_MAX_CHARS = 280;

/** A word-boundary cut that would drop more than this share of the budget cuts mid-word instead. */
const MIN_WORD_CUT_SHARE = 0.6;

const WRAPPING_QUOTES = /^["'“”‘’`]+|["'“”‘’`]+$/g;

/** Collapses whitespace and strips wrapping quotes, the shapes models most often add. */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(WRAPPING_QUOTES, "").trim();
}

/** Cuts `text` to at most `max` characters, at a word boundary where one is close, with "…". */
export function clampAtWord(text: string, max: number): string {
  const clean = normalize(text);

  if (clean.length <= max) return clean;

  const budget = Math.max(1, max - 1);
  const cut = clean.slice(0, budget + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const head =
    lastSpace >= budget * MIN_WORD_CUT_SHARE ? cut.slice(0, lastSpace) : clean.slice(0, budget);

  return `${head.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** A first sentence shorter than this is an abbreviation ("e.g."), not a sentence. */
const MIN_FIRST_SENTENCE_CHARS = 16;

/** A card title: one sentence of plain words, no trailing period, never past the two-line budget. */
export function clampResurfaceTitle(text: string, max: number = RESURFACE_TITLE_MAX_CHARS): string {
  const clean = normalize(text);
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? "";
  const title = clampAtWord(
    firstSentence.length >= MIN_FIRST_SENTENCE_CHARS ? firstSentence : clean,
    max
  );

  return title.endsWith("…") ? title : title.replace(/\.+$/, "");
}

export function clampResurfaceRecap(text: string): string {
  return clampAtWord(text, RESURFACE_RECAP_MAX_CHARS);
}
