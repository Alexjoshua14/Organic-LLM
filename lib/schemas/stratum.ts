import { z } from "zod";

import { optionalStringCatch, stringArrayWithCatch } from "./gen-ui/shared";

/** Schema version for Stratum discovery blocks (bump when breaking). */
export const STRATUM_VERSION = z.literal(1);

/** Discovery stages, in the order the interview normally moves through them. */
export const STRATUM_STAGES = ["concept", "users", "features", "architecture", "spec"] as const;

export const StratumStageSchema = z.enum(STRATUM_STAGES).catch("concept");

export type StratumStage = (typeof STRATUM_STAGES)[number];

const FieldIdSchema = z.string().min(1);

const SelectOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: optionalStringCatch(),
});

export type StratumSelectOption = z.infer<typeof SelectOptionSchema>;

const fieldBase = {
  id: FieldIdSchema,
  label: z.string().min(1),
  hint: optionalStringCatch(),
  /** Optional fields may be skipped; skipped answers are reported as such. */
  optional: z.boolean().optional().catch(undefined),
};

export const StratumTextFieldSchema = z.object({
  ...fieldBase,
  kind: z.literal("text"),
  placeholder: optionalStringCatch(),
});

export const StratumLongTextFieldSchema = z.object({
  ...fieldBase,
  kind: z.literal("long_text"),
  placeholder: optionalStringCatch(),
});

export const StratumSingleSelectFieldSchema = z.object({
  ...fieldBase,
  kind: z.literal("single_select"),
  options: z.array(SelectOptionSchema).min(2).max(6),
  /** Show an "Other" free-text escape hatch. */
  allowCustom: z.boolean().optional().catch(undefined),
});

export const StratumMultiSelectFieldSchema = z.object({
  ...fieldBase,
  kind: z.literal("multi_select"),
  options: z.array(SelectOptionSchema).min(2).max(8),
  allowCustom: z.boolean().optional().catch(undefined),
});

export const StratumScaleFieldSchema = z.object({
  ...fieldBase,
  kind: z.literal("scale"),
  /** Anchors for 1 and 5 (e.g. "nice to have" → "critical"). */
  minLabel: z.string().min(1),
  maxLabel: z.string().min(1),
});

export const StratumFieldSchema = z.discriminatedUnion("kind", [
  StratumTextFieldSchema,
  StratumLongTextFieldSchema,
  StratumSingleSelectFieldSchema,
  StratumMultiSelectFieldSchema,
  StratumScaleFieldSchema,
]);

export type StratumField = z.infer<typeof StratumFieldSchema>;
export type StratumFieldKind = StratumField["kind"];

/** One round of discovery questions rendered as an interactive form. */
export const StratumFormSchema = z.object({
  type: z.literal("stratum-form"),
  version: STRATUM_VERSION,
  stage: StratumStageSchema,
  title: z.string().min(1),
  intro: optionalStringCatch(),
  fields: z.array(StratumFieldSchema).min(1).max(6),
  submitLabel: optionalStringCatch(),
});

export type StratumForm = z.infer<typeof StratumFormSchema>;

export const StratumFeaturePrioritySchema = z.enum(["must", "should", "could"]).catch("should");

export const StratumSpecFeatureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: optionalStringCatch(),
  priority: StratumFeaturePrioritySchema,
});

export const StratumSpecComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** What this component is responsible for. */
  role: z.string().min(1),
  stack: optionalStringCatch(),
});

/**
 * Self-contained context chunk the user can paste into another system
 * (Cursor, an agent, a developer). Body must stand alone without the thread.
 */
export const StratumSpecHandoffSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  target: optionalStringCatch(),
  body: z.string().min(1),
});

export const StratumSpecArchitectureSchema = z.object({
  overview: optionalStringCatch(),
  components: z.array(StratumSpecComponentSchema).max(10).catch([]),
  dataFlows: stringArrayWithCatch(8).catch([]),
});

/** Living product spec — re-emitted in full whenever discovery changes it. */
export const StratumSpecSchema = z.object({
  type: z.literal("stratum-spec"),
  version: STRATUM_VERSION,
  name: z.string().min(1),
  tagline: optionalStringCatch(),
  summary: z.string().min(1),
  problem: optionalStringCatch(),
  audience: stringArrayWithCatch(6).catch([]),
  features: z.array(StratumSpecFeatureSchema).max(16).catch([]),
  architecture: StratumSpecArchitectureSchema.optional().catch(undefined),
  risks: stringArrayWithCatch(8).catch([]),
  openQuestions: stringArrayWithCatch(8).catch([]),
  handoffs: z.array(StratumSpecHandoffSchema).max(8).catch([]),
  /** Model's estimate of how much of the product picture is uncovered (0–100). */
  coverage: z.number().min(0).max(100).optional().catch(undefined),
});

export type StratumSpec = z.infer<typeof StratumSpecSchema>;
export type StratumSpecFeature = z.infer<typeof StratumSpecFeatureSchema>;
export type StratumSpecHandoff = z.infer<typeof StratumSpecHandoffSchema>;

/** Tool output shapes — strict contracts for client hydrate. */
export const StratumFormToolOutputSchema = z.object({
  kind: z.literal("stratum-form"),
  form: StratumFormSchema,
});

export const StratumSpecToolOutputSchema = z.object({
  kind: z.literal("stratum-spec"),
  spec: StratumSpecSchema,
});

export type StratumFormToolOutput = z.infer<typeof StratumFormToolOutputSchema>;
export type StratumSpecToolOutput = z.infer<typeof StratumSpecToolOutputSchema>;

export function tryParseStratumFormToolOutput(output: unknown): StratumFormToolOutput | null {
  const parsed = StratumFormToolOutputSchema.safeParse(output);

  return parsed.success ? parsed.data : null;
}

export function tryParseStratumSpecToolOutput(output: unknown): StratumSpecToolOutput | null {
  const parsed = StratumSpecToolOutputSchema.safeParse(output);

  return parsed.success ? parsed.data : null;
}

/** A submitted value: free text, selected option labels, or a 1–5 scale point. */
export type StratumAnswerValue = string | string[] | number;

export type StratumAnswers = Record<string, StratumAnswerValue>;

function formatAnswerValue(value: StratumAnswerValue | undefined): string | null {
  if (value === undefined) return null;
  if (typeof value === "number") return `${value}/5`;
  if (Array.isArray(value)) {
    const items = value.map((v) => v.trim()).filter((v) => v.length > 0);

    return items.length > 0 ? items.join(", ") : null;
  }
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Serialize submitted form answers into the user message sent back to the chat.
 * Kept deterministic so the model can reliably mine answers out of the turn.
 */
export function formatStratumFormAnswers(form: StratumForm, answers: StratumAnswers): string {
  const lines: string[] = [`Discovery answers — ${form.title} (${form.stage})`, ""];

  for (const field of form.fields) {
    const rendered = formatAnswerValue(answers[field.id]);

    if (rendered === null) {
      lines.push(`- ${field.label}: _skipped_`);
    } else {
      lines.push(`- ${field.label}: ${rendered}`);
    }
  }

  return lines.join("\n");
}

/** Fallback markdown when the form block cannot be rendered as UI. */
export function stratumFormToMarkdown(form: StratumForm): string {
  const lines: string[] = [`## ${form.title}`, ""];

  if (form.intro) {
    lines.push(form.intro, "");
  }

  for (const field of form.fields) {
    lines.push(`- **${field.label}**${field.hint ? ` — ${field.hint}` : ""}`);
    if (field.kind === "single_select" || field.kind === "multi_select") {
      for (const option of field.options) {
        lines.push(`  - ${option.label}${option.description ? ` — ${option.description}` : ""}`);
      }
    }
    if (field.kind === "scale") {
      lines.push(`  - 1 = ${field.minLabel} … 5 = ${field.maxLabel}`);
    }
  }

  return lines.join("\n").trim();
}

const PRIORITY_LABELS: Record<z.infer<typeof StratumFeaturePrioritySchema>, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
};

/** Full spec as portable markdown (spec-sheet copy button; also the render fallback). */
export function stratumSpecToMarkdown(spec: StratumSpec): string {
  const lines: string[] = [`# ${spec.name}`];

  if (spec.tagline) lines.push(`_${spec.tagline}_`);
  lines.push("", "## Summary", spec.summary);

  if (spec.problem) {
    lines.push("", "## Problem", spec.problem);
  }
  if (spec.audience.length > 0) {
    lines.push("", "## Audience", ...spec.audience.map((a) => `- ${a}`));
  }
  if (spec.features.length > 0) {
    lines.push("", "## Features");
    for (const feature of spec.features) {
      lines.push(
        `- **[${PRIORITY_LABELS[feature.priority]}] ${feature.title}**${feature.detail ? ` — ${feature.detail}` : ""}`
      );
    }
  }
  if (spec.architecture) {
    lines.push("", "## Architecture");
    if (spec.architecture.overview) lines.push(spec.architecture.overview);
    for (const component of spec.architecture.components) {
      lines.push(
        `- **${component.name}** — ${component.role}${component.stack ? ` (${component.stack})` : ""}`
      );
    }
    if (spec.architecture.dataFlows.length > 0) {
      lines.push("", "### Data flows", ...spec.architecture.dataFlows.map((f) => `- ${f}`));
    }
  }
  if (spec.risks.length > 0) {
    lines.push("", "## Risks", ...spec.risks.map((r) => `- ${r}`));
  }
  if (spec.openQuestions.length > 0) {
    lines.push("", "## Open questions", ...spec.openQuestions.map((q) => `- ${q}`));
  }
  if (spec.handoffs.length > 0) {
    lines.push("", "## Handoff chunks");
    for (const handoff of spec.handoffs) {
      lines.push(
        "",
        `### ${handoff.title}${handoff.target ? ` (${handoff.target})` : ""}`,
        handoff.body
      );
    }
  }

  return lines.join("\n").trim();
}
