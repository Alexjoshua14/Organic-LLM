import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const ProgressMilestoneSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
});

/** Continuous progress bar with milestone markers. */
export const ProgressTrackBlockSchema = z
  .object({
    type: z.literal("progress-track"),
    version: GEN_UI_VERSION,
    title: z.string().min(1),
    total: z.number().positive(),
    current: z.number().min(0),
    milestones: z.array(ProgressMilestoneSchema).max(12).default([]),
    unit: z.string().default(""),
    footnote: optionalStringCatch(),
  })
  .superRefine((b, ctx) => {
    if (b.current > b.total) {
      ctx.addIssue({
        code: "custom",
        path: ["current"],
        message: "current must not exceed total",
      });
    }
    b.milestones.forEach((m, i) => {
      if (m.value < 0 || m.value > b.total) {
        ctx.addIssue({
          code: "custom",
          path: ["milestones", i, "value"],
          message: "milestone must sit within 0…total",
        });
      }
    });
  });

export type ProgressTrackBlock = z.infer<typeof ProgressTrackBlockSchema>;
export type ProgressMilestone = z.infer<typeof ProgressMilestoneSchema>;

export function progressTrackToMarkdown(block: ProgressTrackBlock): string {
  const lines: string[] = [
    `## ${block.title}`,
    "",
    `Progress: ${block.current}${block.unit} / ${block.total}${block.unit}`,
  ];

  if (block.milestones.length) {
    lines.push("", "Milestones:");
    for (const m of block.milestones) {
      lines.push(`- ${m.label} @ ${m.value}${block.unit}`);
    }
  }
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function progressTrackToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Progress";

  return `## ${title}\n\n_(Progress track — structured view unavailable)_`;
}
