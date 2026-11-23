import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const RippleKindSchema = z.enum(["blocked", "stale", "update", "warning", "info"]);

export const RippleEffectSchema = z.object({
  id: z.string().min(1),
  kind: RippleKindSchema,
  label: z.string().min(1),
  detail: optionalStringCatch(),
  /** When false, the effect starts unchecked (not approved). */
  approved: z.boolean().default(true),
});

/**
 * Ripple Preview: stage a change, review cascading effects, apply only approved ones.
 * Host binds `onApply(approvedIds)`; without it the card is preview-only.
 */
export const RipplePreviewBlockSchema = z.object({
  type: z.literal("ripple-preview"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  change: z.object({
    summary: z.string().min(1),
    detail: optionalStringCatch(),
  }),
  ripples: z.array(RippleEffectSchema).min(1).max(24),
  footnote: optionalStringCatch(),
});

export type RipplePreviewBlock = z.infer<typeof RipplePreviewBlockSchema>;
export type RippleEffect = z.infer<typeof RippleEffectSchema>;
export type RippleKind = z.infer<typeof RippleKindSchema>;

export function ripplePreviewToMarkdown(block: RipplePreviewBlock): string {
  const lines: string[] = [
    `## ${block.title}`,
    "",
    `**Change:** ${block.change.summary}`,
  ];

  if (block.change.detail) lines.push(block.change.detail);
  lines.push("", "Ripples:");
  for (const r of block.ripples) {
    const mark = r.approved ? "[x]" : "[ ]";

    lines.push(`- ${mark} **${r.label}** (${r.kind})`);
    if (r.detail) lines.push(`  - ${r.detail}`);
  }
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function ripplePreviewToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Ripple preview";

  return `## ${title}\n\n_(Ripple preview — structured view unavailable)_`;
}
