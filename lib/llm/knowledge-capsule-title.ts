import type { Result } from "@/types";

import { generateText } from "ai";
import { z } from "zod";

import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { createLlmBudgetHooks } from "@/lib/plans/llm-budget-hooks";
import { recordLlmCall } from "@/lib/llm/metrics";
import { TITLE_PIPELINE_SHORT_TITLE_MODEL } from "@/lib/llm/title-models";

const logger = createLogger("lib/llm/knowledge-capsule-title.ts");

/** Max words per grammar slot (action / subject / additional). */
export const KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS = 2;

/**
 * Combined title word cap. Spirit is ~4 words; the explicit product rule is 5.
 */
export const KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS = 5;

export const KnowledgeCapsuleSlotsSchema = z.object({
  action: z.string().default(""),
  subject: z.string().default(""),
  additional: z.string().default(""),
});

export type KnowledgeCapsuleSlots = z.infer<typeof KnowledgeCapsuleSlotsSchema>;

export type KnowledgeCapsuleParseStatus = "ok" | "repaired" | "invalid";

export type KnowledgeCapsuleParseResult = {
  status: KnowledgeCapsuleParseStatus;
  slots: KnowledgeCapsuleSlots;
  title: string;
  wordCount: number;
  /** Human-readable notes about repairs or parse failures (lab / logs). */
  notes: string[];
  /** Raw model line before normalization, when available. */
  rawText: string;
};

/**
 * System prompt for the knowledge-capsule short-title step.
 * Separate from legacy `CHAT_TITLE_SYSTEM` — do not share wording casually.
 */
export const KNOWLEDGE_CAPSULE_TITLE_SYSTEM = `
You name Organic LLM chat threads as knowledge capsules for the sidebar.

A knowledge capsule is a tight phrase that conveys what the thread holds: its contents, needs, or notifs — something a person can scan days later.

## Grammar (required)
Compose the title from up to three slots, then join them with single spaces into one line:

1. **action** — up to 2 words (verb / task cue), optional when the subject alone is enough
2. **subject** — up to 2 words (the concrete thing), usually present
3. **additional** — up to 2 words (qualifier, place, date, notif cue), optional

**Whole title:** at most **5 words** total across all slots (prefer ~4). Never exceed 5.

## Output format
Return exactly one JSON object on a single line, no markdown fences, no commentary:
{"action":"...","subject":"...","additional":"..."}

Use empty string "" for unused slots. Do not invent filler for empty slots.

## Style
- Match the user's language when the summary is clearly non-English.
- Prefer concrete nouns (projects, people, places, systems) over "Question", "Help", "Chat", "Discussion".
- Drop filler: no "Can you", "I want to", "How do I".
- Title Case or sentence case is fine; be consistent within one title.
- No trailing punctuation. No quotes around the whole title.

## Low-signal threads
- Greeting-only / no topic → {"action":"","subject":"New chat","additional":""}
- Light back-and-forth, nothing to revisit → {"action":"","subject":"Quick chat","additional":""} or Brief exchange
- One-off lookup with anchors → put topic in subject, place/date in additional (e.g. subject "SF weather", additional "May 3") — still ≤5 words total.

## Examples (summary → JSON)
- Postgres schema for orders → {"action":"Design","subject":"order schema","additional":""}
- Next.js hydration debug → {"action":"Fix","subject":"Next hydration","additional":""}
- Vendor decline email → {"action":"Draft","subject":"vendor decline","additional":""}
- Greetings only → {"action":"","subject":"New chat","additional":""}
- SF weather May 3 → {"action":"","subject":"SF weather","additional":"May 3"}
`.trim();

/** Summarizer prompt tuned for capsule naming (step 1 of the beta pipeline). */
export const KNOWLEDGE_CAPSULE_SUMMARIZER_SYSTEM = `
You are Organic LLM's knowledge-capsule title summarizer.
Summarize the conversation into ONE clear paragraph (2–4 sentences, under 600 tokens) so a separate model can name the chat as a knowledge capsule.
A knowledge capsule conveys contents, needs, or notifs in a few words — surface the actionable verb, concrete subject, and any short qualifier (place, date, urgency).
For low-signal threads, stay proportional: greeting / small talk with no task should be stated plainly.
For ephemeral lookups, name topic and anchors (place, date) without dramatizing.
Be concise, neutral, plain text only—no lists, markdown, or citations.
`.trim();

const WORD_RE = /[^\s]+/g;

/** Split on whitespace; strips empty tokens. */
export function splitWords(text: string): string[] {
  const matches = text.trim().match(WORD_RE);

  return matches ?? [];
}

export function joinSlots(slots: KnowledgeCapsuleSlots): string {
  return [slots.action, slots.subject, slots.additional]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function capSlotWords(text: string, maxWords: number): { text: string; truncated: boolean } {
  const words = splitWords(text);

  if (words.length <= maxWords) {
    return { text: words.join(" "), truncated: false };
  }

  return { text: words.slice(0, maxWords).join(" "), truncated: true };
}

/**
 * Enforce per-slot and combined word caps. Prefers dropping/truncating **additional**,
 * then **subject**, then **action** when the combined cap is exceeded.
 */
export function normalizeKnowledgeCapsuleSlots(
  input: KnowledgeCapsuleSlots
): { slots: KnowledgeCapsuleSlots; notes: string[]; repaired: boolean } {
  const notes: string[] = [];
  let repaired = false;

  const actionCap = capSlotWords(input.action, KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS);
  const subjectCap = capSlotWords(input.subject, KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS);
  const additionalCap = capSlotWords(input.additional, KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS);

  if (actionCap.truncated) {
    notes.push(`action truncated to ${KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS} words`);
    repaired = true;
  }
  if (subjectCap.truncated) {
    notes.push(`subject truncated to ${KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS} words`);
    repaired = true;
  }
  if (additionalCap.truncated) {
    notes.push(`additional truncated to ${KNOWLEDGE_CAPSULE_SLOT_MAX_WORDS} words`);
    repaired = true;
  }

  let action = actionCap.text;
  let subject = subjectCap.text;
  let additional = additionalCap.text;

  const totalWords = () =>
    splitWords(action).length + splitWords(subject).length + splitWords(additional).length;

  while (totalWords() > KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS) {
    repaired = true;
    const additionalWords = splitWords(additional);
    if (additionalWords.length > 0) {
      additional = additionalWords.slice(0, -1).join(" ");
      notes.push("dropped trailing additional word to meet 5-word cap");
      continue;
    }
    const subjectWords = splitWords(subject);
    if (subjectWords.length > 1) {
      subject = subjectWords.slice(0, -1).join(" ");
      notes.push("dropped trailing subject word to meet 5-word cap");
      continue;
    }
    const actionWords = splitWords(action);
    if (actionWords.length > 1) {
      action = actionWords.slice(0, -1).join(" ");
      notes.push("dropped trailing action word to meet 5-word cap");
      continue;
    }
    // Single words left that somehow exceed — strip additional/action first
    if (additional) {
      additional = "";
      notes.push("cleared additional to meet 5-word cap");
      continue;
    }
    if (action && subject) {
      action = "";
      notes.push("cleared action to meet 5-word cap");
      continue;
    }
    break;
  }

  return {
    slots: { action, subject, additional },
    notes,
    repaired,
  };
}

function tryParseJsonSlots(raw: string): KnowledgeCapsuleSlots | null {
  const trimmed = raw.trim();
  // Prefer a JSON object substring if the model wrapped it.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    const result = KnowledgeCapsuleSlotsSchema.safeParse(parsed);
    if (!result.success) return null;

    return {
      action: String(result.data.action ?? "").trim(),
      subject: String(result.data.subject ?? "").trim(),
      additional: String(result.data.additional ?? "").trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Heuristic freeform parse: first ≤2 words → action, next ≤2 → subject, rest (≤2) → additional,
 * then normalize to the 5-word combined cap.
 */
export function parseFreeformCapsuleLine(raw: string): KnowledgeCapsuleSlots {
  const words = splitWords(raw.replace(/^["']|["']$/g, ""));
  const action = words.slice(0, 2).join(" ");
  const subject = words.slice(2, 4).join(" ");
  const additional = words.slice(4, 6).join(" ");

  return { action, subject, additional };
}

/**
 * Parse model output into grammar slots, validating and soft-repairing against caps.
 */
export function parseKnowledgeCapsuleTitle(rawText: string): KnowledgeCapsuleParseResult {
  const raw = rawText.trim();
  const notes: string[] = [];

  if (!raw) {
    return {
      status: "invalid",
      slots: { action: "", subject: "", additional: "" },
      title: "",
      wordCount: 0,
      notes: ["empty model output"],
      rawText: raw,
    };
  }

  let slots = tryParseJsonSlots(raw);
  if (!slots) {
    notes.push("JSON parse failed; used freeform word split");
    slots = parseFreeformCapsuleLine(raw);
  }

  const normalized = normalizeKnowledgeCapsuleSlots(slots);
  notes.push(...normalized.notes);

  const title = joinSlots(normalized.slots);
  const wordCount = splitWords(title).length;

  if (!title) {
    // Last-resort: take first 5 words of raw free text
    const fallbackWords = splitWords(raw.replace(/^["']|["']$/g, "")).slice(
      0,
      KNOWLEDGE_CAPSULE_TITLE_MAX_WORDS
    );
    const fallbackTitle = fallbackWords.join(" ");
    notes.push("slots empty after normalize; used first 5 raw words");

    return {
      status: fallbackTitle ? "repaired" : "invalid",
      slots: parseFreeformCapsuleLine(fallbackTitle),
      title: fallbackTitle,
      wordCount: fallbackWords.length,
      notes,
      rawText: raw,
    };
  }

  const status: KnowledgeCapsuleParseStatus =
    normalized.repaired || notes.some((n) => n.includes("freeform")) ? "repaired" : "ok";

  return {
    status,
    slots: normalized.slots,
    title: title.slice(0, 255),
    wordCount,
    notes,
    rawText: raw,
  };
}

/**
 * Second step of the knowledge-capsule title pipeline: summary → grammar-validated title.
 */
export async function generateKnowledgeCapsuleTitleFromSummary(
  summary: string,
  options: {
    contextId: string;
    ownerId: string;
    operation: string;
  }
): Promise<Result<KnowledgeCapsuleParseResult>> {
  const trimmedSummary = summary.trim();

  if (trimmedSummary.length === 0) {
    return {
      data: {
        status: "invalid",
        slots: { action: "", subject: "", additional: "" },
        title: "",
        wordCount: 0,
        notes: ["empty summary"],
        rawText: "",
      },
      error: null,
    };
  }

  try {
    const titleStart = performance.now();
    const titleResult = await generateText({
      model: TITLE_PIPELINE_SHORT_TITLE_MODEL,
      ...createLlmBudgetHooks({
        ownerId: options.ownerId,
        modelId: TITLE_PIPELINE_SHORT_TITLE_MODEL as string,
        operation: options.operation,
      }),
      instructions: KNOWLEDGE_CAPSULE_TITLE_SYSTEM,
      prompt: trimmedSummary,
      maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    });
    const titleDuration = performance.now() - titleStart;

    recordLlmCall({
      model: TITLE_PIPELINE_SHORT_TITLE_MODEL as string,
      usage: titleResult.usage,
      durationMs: titleDuration,
      metadata: { operation: options.operation, contextId: options.contextId },
    });

    const rawText = (titleResult.text ?? "").trim();
    const parsed = parseKnowledgeCapsuleTitle(rawText);

    return { data: parsed, error: null };
  } catch (err) {
    logger.error(
      "generateKnowledgeCapsuleTitleFromSummary",
      `Error generating capsule title: ${err instanceof Error ? err.message : String(err)}`
    );

    return {
      data: null,
      error: new Error(err instanceof Error ? err.message : "Failed to generate capsule title"),
    };
  }
}
