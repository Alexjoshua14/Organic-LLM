import { z } from "zod";

import { GEN_UI_VERSION, httpUrl } from "./shared";

const AnswerCardSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
  defaultOpen: z.boolean().optional(),
});

const AnswerCardSourceSchema = z.object({
  label: z.string().catch("Source"),
  url: httpUrl().optional().catch(undefined),
});

const AnswerCardFooterSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.array(AnswerCardSourceSchema).max(12).optional(),
  caveats: z
    .array(z.string().catch(""))
    .max(8)
    .optional()
    .transform((arr) => arr?.filter((s) => s.length > 0)),
});

export const AnswerCardBlockSchema = z.object({
  type: z.literal("answer-card"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  tldr: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1).max(7),
  sections: z.array(AnswerCardSectionSchema).max(10).optional(),
  footer: AnswerCardFooterSchema.optional(),
});

export type AnswerCardBlock = z.infer<typeof AnswerCardBlockSchema>;

export function answerCardToMarkdown(block: AnswerCardBlock): string {
  const lines: string[] = [`## ${block.title}`, "", `**TL;DR:** ${block.tldr}`, ""];

  if (block.keyPoints.length > 0) {
    lines.push("### Key points", "");
    for (const p of block.keyPoints) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  if (block.sections?.length) {
    for (const s of block.sections) {
      lines.push(`### ${s.heading}`, "", s.body, "");
    }
  }

  if (block.footer) {
    lines.push(`_Confidence: ${block.footer.confidence}_`);
    if (block.footer.sources?.length) {
      lines.push("");
      for (const src of block.footer.sources) {
        lines.push(src.url ? `- [${src.label}](${src.url})` : `- ${src.label}`);
      }
    }
    if (block.footer.caveats?.length) {
      lines.push("");
      for (const c of block.footer.caveats) {
        lines.push(`> ${c}`);
      }
    }
  }

  return lines.join("\n").trim();
}

/** Best-effort markdown when full parse failed. */
export function answerCardToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Answer";
  const tldr = typeof raw.tldr === "string" ? raw.tldr : "";
  const keyPoints = Array.isArray(raw.keyPoints)
    ? raw.keyPoints.filter((x): x is string => typeof x === "string")
    : [];

  return answerCardToMarkdown({
    type: "answer-card",
    version: 1,
    title,
    tldr: tldr || "(summary unavailable)",
    keyPoints: keyPoints.length > 0 ? keyPoints : ["(content unavailable)"],
  });
}
