import { z } from "zod";

export const MemoryQualitySchema = z.object({
  decision: z.enum(["keep", "drop"]),
  reason: z.string().optional(),
});

export type MemoryQuality = z.infer<typeof MemoryQualitySchema>;

export const MEMORY_QUALITY_CLASSIFIER_SYSTEM = `You filter stored "memory" facts for a personal AI assistant.

Output a single JSON object only, with exactly these keys:
  "decision": either the string "keep" or the string "drop"
  "reason": optional short string

Do not output JSON Schema metadata: no "type", "properties", "$schema", or nested schema objects. Example of correct output:
{"decision":"drop","reason":"Generic fragment with no user-specific fact."}

KEEP (keep) memories that are durable, user-specific preferences or facts about the user/project — things worth retrieving later.

DROP (drop): placeholders like [] or empty shells; meta lines about ML types without substance; trivial fragments ("Latency tells you how fast"); standalone homework/read intentions ("I will read the note tomorrow"); generic definitions with no user linkage; assistant-task staging ("User asked the assistant to choose…") unless it clearly records a durable user decision.

Examples — DROP:
- []
- ML type: ML integrator
- Latency tells you 'how fast'.
- I will read the Obsidian note tomorrow.
- User asked the assistant to choose the state management solution.

Examples — KEEP:
- User is interested in backend trace APIs that feed the UI.
- Organic LLM treats spoken output as a first-class pipeline rather than an afterthought.
- User prefers skipping introductory rationale when learning T3 patterns.`;

/**
 * Some models return a JSON Schema envelope instead of the instance.
 */
export function parseMemoryQualityFromModelText(raw: string): MemoryQuality | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const o = parsed as Record<string, unknown>;
  let candidate: unknown = o;

  if (o.type === "object" && o.properties && typeof o.properties === "object") {
    candidate = o.properties;
  }

  const r = MemoryQualitySchema.safeParse(candidate);

  return r.success ? r.data : null;
}

export type MemoryIngestGoldenCase = {
  id: string;
  turns: Array<{ role: "user" | "assistant"; content: string }>;
  expectedFacts: string[];
  antiPatterns?: string[];
  probeQueries?: string[];
};

export type DeterministicIngestScore = {
  caseId: string;
  passed: boolean;
  missingFacts: string[];
  antiPatternHits: string[];
  charCount: number;
};

/** Deterministic scoring for golden cases (no LLM). */
export function scoreIngestOutputDeterministic(
  caseId: string,
  outputText: string,
  golden: Pick<MemoryIngestGoldenCase, "expectedFacts" | "antiPatterns">
): DeterministicIngestScore {
  const normalized = outputText.toLowerCase();
  const missingFacts = golden.expectedFacts.filter(
    (fact) => !normalized.includes(fact.toLowerCase())
  );
  const antiPatternHits = (golden.antiPatterns ?? []).filter((pattern) =>
    normalized.includes(pattern.toLowerCase())
  );

  const isRejectionCase =
    golden.expectedFacts.length === 0 && (golden.antiPatterns?.length ?? 0) > 0;
  const passed =
    isRejectionCase ?
      antiPatternHits.length > 0
    : missingFacts.length === 0 && antiPatternHits.length === 0;

  return {
    caseId,
    passed,
    missingFacts,
    antiPatternHits,
    charCount: outputText.length,
  };
}

/** Best-effort distill of a candidate memory string from conversation turns. */
export function distillCandidateFromTurns(
  turns: MemoryIngestGoldenCase["turns"]
): string {
  const lastUser = [...turns].reverse().find((t) => t.role === "user");

  if (lastUser) return lastUser.content.trim();

  const last = turns[turns.length - 1];

  return last?.content.trim() ?? "";
}
