import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const MatrixScoreValueSchema = z.union([
  z.number().min(1).max(5),
  z.enum(["✓", "✗", "~"]),
]);

export const MatrixScoreCellSchema = z.object({
  value: MatrixScoreValueSchema.catch("~" as const),
  note: optionalStringCatch(),
});

export const DecisionMatrixOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  note: optionalStringCatch(),
});

export const DecisionMatrixCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(1).max(5).optional(),
});

export const DecisionMatrixRecommendationSchema = z.object({
  optionId: z.string().min(1),
  rationale: z.string().min(1),
});

/** Lenient scores map: bad cells become ~ with no note. */
const ScoresRecordSchema = z.record(z.string(), z.record(z.string(), MatrixScoreCellSchema));

export const DecisionMatrixBlockSchema = z.object({
  type: z.literal("decision-matrix"),
  version: GEN_UI_VERSION,
  question: z.string().min(1),
  options: z.array(DecisionMatrixOptionSchema).min(2).max(8),
  criteria: z.array(DecisionMatrixCriterionSchema).min(2).max(6),
  scores: ScoresRecordSchema,
  recommendation: DecisionMatrixRecommendationSchema.optional(),
});

export type DecisionMatrixBlock = z.infer<typeof DecisionMatrixBlockSchema>;
export type MatrixScoreValue = z.infer<typeof MatrixScoreValueSchema>;
export type MatrixScoreCell = z.infer<typeof MatrixScoreCellSchema>;

export function formatMatrixScoreValue(value: MatrixScoreValue): string {
  return typeof value === "number" ? String(value) : value;
}

export function decisionMatrixToMarkdown(block: DecisionMatrixBlock): string {
  const lines: string[] = [`## ${block.question}`, ""];

  const header = ["", ...block.criteria.map((c) => c.label)];
  lines.push(`| Option | ${header.slice(1).join(" | ")} |`);
  lines.push(`| --- | ${block.criteria.map(() => "---").join(" | ")} |`);

  for (const opt of block.options) {
    const cells = block.criteria.map((c) => {
      const cell = block.scores[opt.id]?.[c.id];
      const v = cell ? formatMatrixScoreValue(cell.value) : "—";
      return v;
    });
    lines.push(`| ${opt.name} | ${cells.join(" | ")} |`);
  }

  if (block.recommendation) {
    const rec = block.options.find((o) => o.id === block.recommendation!.optionId);
    lines.push("");
    lines.push(
      `**Recommended:** ${rec?.name ?? block.recommendation.optionId} — ${block.recommendation.rationale}`
    );
  }

  return lines.join("\n").trim();
}

export function decisionMatrixToMarkdownLoose(raw: Record<string, unknown>): string {
  const question = typeof raw.question === "string" ? raw.question : "Comparison";
  return `## ${question}\n\n_(Decision matrix — structured view unavailable)_`;
}
