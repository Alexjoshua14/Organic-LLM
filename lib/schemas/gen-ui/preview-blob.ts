import { z } from "zod";

import { GEN_UI_VERSION, httpUrl, optionalStringCatch } from "./shared";

/**
 * Low-cost graphic preview: thumbnail URL, optional expanded SVG/diagram URL,
 * optional generation prompt and cost estimate. URLs are http(s) only.
 * Full-fidelity render / agent sandbox generation is a host concern.
 */
export const PreviewBlobBlockSchema = z.object({
  type: z.literal("preview-blob"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  previewURL: httpUrl(),
  svgURL: httpUrl().optional(),
  prompt: optionalStringCatch(),
  /** Human-readable cost hint, e.g. "~$0.02" — not parsed as money. */
  costEstimate: optionalStringCatch(),
  footnote: optionalStringCatch(),
});

export type PreviewBlobBlock = z.infer<typeof PreviewBlobBlockSchema>;

export function previewBlobToMarkdown(block: PreviewBlobBlock): string {
  const lines: string[] = [
    `## ${block.title}`,
    "",
    `Preview: ${block.previewURL}`,
  ];

  if (block.svgURL) lines.push(`Expanded: ${block.svgURL}`);
  if (block.prompt) lines.push("", `Prompt: ${block.prompt}`);
  if (block.costEstimate) lines.push(`Cost estimate: ${block.costEstimate}`);
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function previewBlobToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Preview";

  return `## ${title}\n\n_(Preview blob — structured view unavailable)_`;
}
