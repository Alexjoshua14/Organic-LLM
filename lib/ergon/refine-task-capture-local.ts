import type { TaskInsert } from "@/lib/schemas/tasks";

/** Sentence-case the first character when the title starts with a lowercase letter. */
export function sentenceCaseTitle(title: string): string {
  const trimmed = title.trim();

  if (trimmed.length === 0) return trimmed;

  const first = trimmed[0]!;

  if (/[a-z]/.test(first)) {
    return first.toUpperCase() + trimmed.slice(1);
  }

  return trimmed;
}

export function refineTasksLocally(titles: string[]): TaskInsert[] {
  return titles.map((title) => ({
    title: sentenceCaseTitle(title),
    tags: [],
  }));
}

/** True when pasted text likely benefits from LLM extraction beyond local cleanup. */
export function titleHasMetadataSignals(title: string): boolean {
  return (
    DATE_SIGNAL.test(title) ||
    DURATION_SIGNAL.test(title) ||
    PRIORITY_SIGNAL.test(title) ||
    EFFORT_SIGNAL.test(title) ||
    CATEGORY_HINT_SIGNAL.test(title)
  );
}

export function needsLlmRefinement(titles: string[]): boolean {
  return titles.some((title) => titleHasMetadataSignals(title.trim()));
}

const DATE_SIGNAL =
  /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week|end of week|by monday|by tuesday|by wednesday|by thursday|by friday|by saturday|by sunday|due\b|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})\b/i;

const DURATION_SIGNAL =
  /\b(\d+\s*(?:min|mins|minutes|minute|hr|hrs|hour|hours|h)|~\s*\d+|half\s+an?\s+hour|half\s+hour|quarter\s+hour)\b/i;

const PRIORITY_SIGNAL = /\b(urgent|asap|critical|important|high priority|low priority)\b/i;

const EFFORT_SIGNAL = /\b(low effort|high effort|mental effort|easy task|hard task)\b/i;

/** Loose hint that a category name might appear in the title (for LLM + validation). */
const CATEGORY_HINT_SIGNAL = /\b(work|home|personal|errands|health|shopping)\b/i;

export function titleSupportsDueDate(title: string): boolean {
  return DATE_SIGNAL.test(title);
}

export function titleSupportsPlannedDate(title: string): boolean {
  return DATE_SIGNAL.test(title);
}

export function titleSupportsEstMinutes(title: string): boolean {
  return DURATION_SIGNAL.test(title);
}

export function titleSupportsPriority(title: string): boolean {
  return PRIORITY_SIGNAL.test(title);
}

export function titleSupportsMentalEffort(title: string): boolean {
  return EFFORT_SIGNAL.test(title);
}

export function titleSupportsCategory(title: string, categoryName: string): boolean {
  const normalized = categoryName.trim().toLowerCase();

  if (normalized.length < 2) return false;

  return title.toLowerCase().includes(normalized);
}
