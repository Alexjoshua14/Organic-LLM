/**
 * Abstract identity-mark prompt constraints.
 *
 * Marks represent the *surface* of a subagent (form, material, light, geometry).
 * They must never depict humans, faces, portraits, or humanoid characters.
 */

/** Phrases that must never appear in an identity prompt (case-insensitive). */
export const IDENTITY_IMAGE_HUMAN_SUBJECT_TERMS = [
  "human",
  "person",
  "people",
  "face",
  "faces",
  "portrait",
  "portraits",
  "humanoid",
  "mannequin",
  "android",
  "cyborg",
  "body",
  "bodies",
  "woman",
  "man",
  "child",
  "figure standing",
  "selfie",
  "headshot",
  "silhouette of a person",
] as const;

export const IDENTITY_IMAGE_STYLE_DIRECTIVE =
  "Abstract non-figurative identity mark: form, material, light, and geometry only. " +
  "No people, no faces, no portraits, no humanoid characters, no body parts. " +
  "Recognizable as a unique emblematic surface — calm, organic-futuristic, not a logo text lockup.";

export type IdentityPromptInput = {
  name: string;
  displayRole: string;
  runtimeRole: "orchestrator" | "worker";
  surfaceTraits: string[];
};

export type IdentityPromptValidation =
  | { ok: true; prompt: string }
  | { ok: false; reason: string; matchedTerm: string };

function normalizeForScan(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Reject prompts (or trait strings) that request human / humanoid subjects.
 * Uses word-boundary matching so the style directive's own "humanoid" ban
 * does not false-positive on the substring "human".
 */
export function assertNonHumanIdentitySubject(text: string): IdentityPromptValidation {
  const normalized = normalizeForScan(text);
  for (const term of IDENTITY_IMAGE_HUMAN_SUBJECT_TERMS) {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`);
    if (re.test(normalized)) {
      return {
        ok: false,
        reason: `Identity images must not depict human subjects (matched: "${term}")`,
        matchedTerm: term,
      };
    }
  }
  return { ok: true, prompt: text };
}

/**
 * Build a generation prompt. Throws if traits violate the non-human constraint.
 * The fixed style directive names banned subjects on purpose; only user-supplied
 * fields are scanned (scanning the composed prompt would false-positive).
 */
export function buildSubagentIdentityPrompt(input: IdentityPromptInput): string {
  const traits = input.surfaceTraits.map((t) => t.trim()).filter(Boolean);
  if (traits.length === 0) {
    throw new Error("surfaceTraits required for identity image prompt");
  }

  for (const trait of traits) {
    const check = assertNonHumanIdentitySubject(trait);
    if (!check.ok) {
      throw new Error(check.reason);
    }
  }

  for (const field of [input.name, input.displayRole, input.runtimeRole]) {
    const check = assertNonHumanIdentitySubject(field);
    if (!check.ok) {
      throw new Error(check.reason);
    }
  }

  return [
    IDENTITY_IMAGE_STYLE_DIRECTIVE,
    `Agent name (for mood only, do not render as readable text): ${input.name}.`,
    `Display role mood: ${input.displayRole}.`,
    `Runtime role mood: ${input.runtimeRole}.`,
    `Surface vocabulary: ${traits.join(", ")}.`,
    "Square composition, soft depth, no typography, no watermark.",
  ].join(" ");
}
