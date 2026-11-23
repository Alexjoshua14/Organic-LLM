import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const PromptSuggestionSchema = z.object({
  label: z.string().min(1),
  insertionText: z.string().min(1),
});

/** Editable prompt with quick-insertion suggestion chips. */
export const PromptFieldBlockSchema = z.object({
  type: z.literal("prompt-field"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  default: z.string().default(""),
  suggestions: z.array(PromptSuggestionSchema).max(12).default([]),
  placeholder: optionalStringCatch(),
  footnote: optionalStringCatch(),
});

export type PromptFieldBlock = z.infer<typeof PromptFieldBlockSchema>;
export type PromptSuggestion = z.infer<typeof PromptSuggestionSchema>;

export function promptFieldToMarkdown(block: PromptFieldBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  if (block.default) lines.push("```", block.default, "```", "");
  if (block.suggestions.length) {
    lines.push("Suggestions:");
    for (const s of block.suggestions) lines.push(`- ${s.label}: \`${s.insertionText}\``);
  }
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function promptFieldToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Prompt";

  return `## ${title}\n\n_(Prompt field — structured view unavailable)_`;
}
