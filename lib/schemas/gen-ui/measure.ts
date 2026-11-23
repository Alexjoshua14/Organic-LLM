import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const MeasureToneSchema = z.enum(["accent", "action", "muted"]);

/** Chart presentation — Stage/widget chrome picks among these. */
export const MeasureVariantSchema = z.enum(["scale", "columns", "line", "pie"]);

/** Widget footprint — denser chrome and shorter plot at `sm`, roomier at `lg`. */
export const MeasureSizeSchema = z.enum(["sm", "md", "lg"]);

export const MeasureRowSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** Point value or bar end on the shared domain. */
    value: z.number().optional(),
    /** Uncertainty / estimate band `[low, high]`. */
    range: z.tuple([z.number(), z.number()]).optional(),
    tone: MeasureToneSchema.default("accent"),
    note: optionalStringCatch(),
  })
  .refine((row) => row.value !== undefined || row.range !== undefined, {
    message: "value or range required",
  });

export const MeasureDomainSchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .refine((d) => d.max > d.min, { message: "domain.max must exceed domain.min" });

/**
 * Shared-scale comparison block. Default `variant: scale` is the horizontal track;
 * `columns` / `line` / `pie` are widget chart forms. `size` controls chrome density.
 */
export const MeasureBlockSchema = z.object({
  type: z.literal("measure"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  subtitle: optionalStringCatch(),
  domain: MeasureDomainSchema,
  unit: z.string().default(""),
  /** Explicit tick positions; omit for five even steps across the domain. */
  ticks: z.array(z.number()).min(2).max(12).optional(),
  rows: z.array(MeasureRowSchema).min(1).max(12),
  variant: MeasureVariantSchema.default("scale"),
  size: MeasureSizeSchema.default("md"),
  footnote: optionalStringCatch(),
});

export type MeasureBlock = z.infer<typeof MeasureBlockSchema>;
export type MeasureRow = z.infer<typeof MeasureRowSchema>;
export type MeasureTone = z.infer<typeof MeasureToneSchema>;
export type MeasureDomain = z.infer<typeof MeasureDomainSchema>;
export type MeasureVariant = z.infer<typeof MeasureVariantSchema>;
export type MeasureSize = z.infer<typeof MeasureSizeSchema>;

export function formatMeasureValue(value: number, unit = ""): string {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}${unit}`;
}

export function measureRowValueLabel(row: MeasureRow, unit: string): string {
  if (row.range) {
    return `${formatMeasureValue(row.range[0])}\u2013${formatMeasureValue(row.range[1], unit)}`;
  }

  return formatMeasureValue(row.value!, unit);
}

export function measureToMarkdown(block: MeasureBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  if (block.subtitle) {
    lines.push(`_${block.subtitle}_`, "");
  }

  for (const row of block.rows) {
    const value = measureRowValueLabel(row, block.unit);
    const note = row.note ? ` — ${row.note}` : "";

    lines.push(`- **${row.label}:** ${value}${note}`);
  }

  if (block.footnote) {
    lines.push("", `_${block.footnote}_`);
  }

  return lines.join("\n").trim();
}

export function measureToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Measure";

  return `## ${title}\n\n_(Measure — structured view unavailable)_`;
}
