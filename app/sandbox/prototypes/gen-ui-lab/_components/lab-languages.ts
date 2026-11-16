import type { CodeDiffBlock } from "@/lib/schemas/gen-ui";
import type { GenUiLanguageOption } from "./GenUiLanguageControls";

import { LANGUAGE_SAMPLES, type LanguageSample } from "../../_fixtures/language-samples";

import { codeLanguageLabel } from "@/components/shared/code-highlight";
import { CodeDiffBlockSchema } from "@/lib/schemas/gen-ui/code-diff";

/** Every language the highlighter supports, in the order the samples are written. */
export const LAB_LANGUAGES: ReadonlyArray<GenUiLanguageOption> = LANGUAGE_SAMPLES.map((sample) => ({
  id: sample.id,
  label: codeLanguageLabel(sample.id),
}));

export const LAB_LANGUAGE_IDS: ReadonlyArray<string> = LAB_LANGUAGES.map((option) => option.id);

const BY_ID = new Map(LANGUAGE_SAMPLES.map((sample) => [sample.id, sample]));

/** The sample for a language id; the first sample if the id is unknown. */
export function sampleFor(id: string): LanguageSample {
  return BY_ID.get(id) ?? LANGUAGE_SAMPLES[0]!;
}

const fence = (language: string, code: string) => `\`\`\`${language}\n${code}\n\`\`\``;

/** The Code page's Snippet slide: a short lead-in and the language's sample, fenced as a model would. */
export function snippetMarkdown(sample: LanguageSample): string {
  return `Here is the change in ${codeLanguageLabel(sample.id)}:\n\n${fence(sample.id, sample.code)}`;
}

/** A code-diff block for a language's sample, exactly as the model would send it. */
export function buildLanguageDiffBlock(sample: LanguageSample): CodeDiffBlock {
  const label = codeLanguageLabel(sample.id);

  return CodeDiffBlockSchema.parse({
    type: "code-diff",
    version: 1,
    title: `A small ${label} change`,
    summary: `One edit in ${label}, sent as unified diff text. The app finds the language from the file path.`,
    files: [{ path: sample.path, diff: sample.diff }],
  });
}
