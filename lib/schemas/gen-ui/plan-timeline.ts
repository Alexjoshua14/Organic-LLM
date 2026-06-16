import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const PlanStepStatusSchema = z.enum(["done", "now", "next", "blocked"]);

export const PlanTimelineSubstepSchema = z.object({
  label: z.string().min(1),
  done: z.boolean().optional(),
});

export const PlanTimelineStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: PlanStepStatusSchema,
  dependsOn: z.array(z.string()).max(10).optional(),
  note: optionalStringCatch(),
  estimate: optionalStringCatch(),
  substeps: z.array(PlanTimelineSubstepSchema).max(15).optional(),
});

export const PlanTimelineBlockSchema = z.object({
  type: z.literal("plan-timeline"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  steps: z.array(PlanTimelineStepSchema).min(1).max(20),
});

export type PlanTimelineBlock = z.infer<typeof PlanTimelineBlockSchema>;
export type PlanTimelineStep = z.infer<typeof PlanTimelineStepSchema>;
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;

export function planTimelineToMarkdown(block: PlanTimelineBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  for (const step of block.steps) {
    const mark =
      step.status === "done"
        ? "[x]"
        : step.status === "now"
          ? "[→]"
          : step.status === "blocked"
            ? "[!]"
            : "[ ]";

    lines.push(`- ${mark} ${step.label}`);
    if (step.estimate) lines.push(`  - _${step.estimate}_`);
    if (step.note) lines.push(`  - ${step.note}`);
    if (step.substeps?.length) {
      for (const sub of step.substeps) {
        lines.push(`  - ${sub.done ? "[x]" : "[ ]"} ${sub.label}`);
      }
    }
  }

  return lines.join("\n").trim();
}

export function planTimelineToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Plan";

  return `## ${title}\n\n_(Plan timeline — structured view unavailable)_`;
}
