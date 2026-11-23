import { z } from "zod";

import { formatMeasureValue, MeasureToneSchema } from "./measure";
import { PlanStepStatusSchema } from "./plan-timeline";
import { GEN_UI_VERSION } from "./shared";

const MAX_ROOT_NODES = 12;
const MAX_DISCLOSURE_NODES = 5;
const MAX_TOTAL_NODES = 24;
const MAX_LIST_ITEMS = 12;
const MAX_SCALE_ROWS = 8;
const MAX_FALLBACK_LENGTH = 1_200;
const MAX_COMPOSITION_BYTES = 12_000;

const label = z.string().trim().min(1).max(120);
const body = z.string().trim().min(1).max(800);
const scaleNumber = z.number().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const httpsSource = z
  .string()
  .max(700)
  .regex(/^https:\/\/[^\s<>\\]+$/i)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);

      return !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Expected an HTTPS source without credentials");

function primitive<Schema extends z.ZodType>(schema: Schema, usage: string) {
  return { schema: schema.describe(usage), usage };
}

const scaleRow = z.strictObject({
  label,
  value: scaleNumber.optional(),
  range: z.tuple([scaleNumber, scaleNumber]).optional(),
  tone: MeasureToneSchema.optional(),
});

const leaves = {
  heading: primitive(
    z.strictObject({ kind: z.literal("heading"), text: label }),
    "Name a subsection when it needs a heading."
  ),
  text: primitive(
    z.strictObject({ kind: z.literal("text"), text: body }),
    "State a finding or provide a short explanation in plain text."
  ),
  list: primitive(
    z.strictObject({
      kind: z.literal("list"),
      ordered: z.boolean().optional(),
      items: z
        .array(
          z.strictObject({
            label,
            status: PlanStepStatusSchema.optional(),
            detail: body.optional(),
          })
        )
        .min(1)
        .max(MAX_LIST_ITEMS),
    }),
    `Show up to ${MAX_LIST_ITEMS} related rows. Use ordered for sequences. Use ${PlanStepStatusSchema.options.join(", ")} only for work status.`
  ),
  scale: primitive(
    z
      .strictObject({
        kind: z.literal("scale"),
        title: label,
        domain: z.strictObject({ min: scaleNumber, max: scaleNumber }),
        unit: z.string().max(12).optional(),
        rows: z.array(scaleRow).min(1).max(MAX_SCALE_ROWS),
      })
      .superRefine(({ domain, rows }, ctx) => {
        const { min, max } = domain;

        if (max <= min) {
          ctx.addIssue({
            code: "custom",
            path: ["domain"],
            message: "Expected a finite increasing scale",
          });
        }
        rows.forEach(({ value, range }, index) => {
          if (value === undefined && !range) {
            ctx.addIssue({
              code: "custom",
              path: ["rows", index],
              message: "Expected value or range",
            });
          }
          if (value !== undefined && (value < min || value > max)) {
            ctx.addIssue({
              code: "custom",
              path: ["rows", index, "value"],
              message: "Value must be on the scale",
            });
          }
          if (
            range &&
            (range[0] > range[1] ||
              range[0] < min ||
              range[1] > max ||
              (value !== undefined && (value < range[0] || value > range[1])))
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["rows", index, "range"],
              message:
                "Range must be ordered, on the scale, and contain the point estimate if supplied",
            });
          }
        });
      }),
    `Compare up to ${MAX_SCALE_ROWS} numeric rows or show progress. Supply a shared domain and value, range, or both. The optional value in a range is its point estimate.`
  ),
  source: primitive(
    z.strictObject({ kind: z.literal("source"), label, url: httpsSource }),
    "Link to a verified HTTPS source using a descriptive label."
  ),
};

const leafSchemas = [
  leaves.heading.schema,
  leaves.text.schema,
  leaves.list.schema,
  leaves.scale.schema,
  leaves.source.schema,
] as const;

const disclosure = primitive(
  z.strictObject({
    kind: z.literal("disclosure"),
    label,
    children: z.array(z.discriminatedUnion("kind", leafSchemas)).min(1).max(MAX_DISCLOSURE_NODES),
  }),
  `Group up to ${MAX_DISCLOSURE_NODES} supporting nodes under an expandable label. Disclosures cannot nest.`
);

const compositionNode = z.discriminatedUnion("kind", [...leafSchemas, disclosure.schema]);

export const CompositionBlockSchema = z
  .strictObject({
    type: z.literal("composition"),
    version: GEN_UI_VERSION,
    title: label,
    nodes: z.array(compositionNode).min(1).max(MAX_ROOT_NODES),
    fallback: z
      .string()
      .trim()
      .min(1)
      .max(MAX_FALLBACK_LENGTH)
      .describe(
        "A self-contained plain-text summary of the result if the composition cannot render."
      ),
  })
  .superRefine((block, ctx) => {
    const count = block.nodes.reduce(
      (total, node) => total + 1 + (node.kind === "disclosure" ? node.children.length : 0),
      0
    );

    if (count > MAX_TOTAL_NODES) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes"],
        message: `Use at most ${MAX_TOTAL_NODES} nodes total`,
      });
    }
    if (new TextEncoder().encode(JSON.stringify(block)).length > MAX_COMPOSITION_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: `Composition exceeds ${MAX_COMPOSITION_BYTES} bytes`,
      });
    }
  });

export type CompositionBlock = z.infer<typeof CompositionBlockSchema>;
export type CompositionNode = CompositionBlock["nodes"][number];

export const COMPOSITION_TOOL_GUIDANCE = [
  `Use type "composition", version 1, with title, ordered nodes, and a plain-text fallback. Use at most ${MAX_ROOT_NODES} top-level nodes, ${MAX_TOTAL_NODES} overall, and ${MAX_COMPOSITION_BYTES} UTF-8 bytes.`,
  ...Object.entries({ ...leaves, disclosure }).map(([kind, entry]) => `- ${kind}: ${entry.usage}`),
  "Use Markdown when prose alone is enough. Combine primitives when their structure makes the answer easier to read, such as a scale plus an evidence disclosure or a status list plus a release readiness scale. Put the primary result at the top level so it stays visible in Condensed. Use only verified values and source URLs. Compose with data only.",
].join("\n");

// Plain text must remain text when copied or handed to the Markdown renderer.
function markdownText(text: string): string {
  return text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "\\$&");
}

function nodeToMarkdown(node: CompositionNode): string {
  switch (node.kind) {
    case "heading":
      return `### ${markdownText(node.text)}`;
    case "text":
      return markdownText(node.text);
    case "list":
      return node.items
        .map((item, index) => {
          const marker = node.ordered ? `${index + 1}.` : "-";
          const status = item.status ? ` (${item.status})` : "";
          const detail = item.detail ? ` — ${markdownText(item.detail)}` : "";

          return `${marker} ${markdownText(item.label)}${status}${detail}`;
        })
        .join("\n");
    case "scale": {
      const format = (value: number) => markdownText(formatMeasureValue(value, node.unit));
      const rows = node.rows.map(({ label, value, range }) => {
        const point = value === undefined ? "" : format(value);
        const band = range ? `${format(range[0])}–${format(range[1])}` : "";

        return `- ${markdownText(label)}: ${band || point}${band && point ? ` (${point} point estimate)` : ""}`;
      });

      return [`### ${markdownText(node.title)}`, "", ...rows].join("\n");
    }
    case "source":
      return `[${markdownText(node.label)}](<${node.url}>)`;
    case "disclosure":
      return [`### ${markdownText(node.label)}`, ...node.children.map(nodeToMarkdown)].join("\n\n");
  }
}

export function compositionToMarkdown(block: CompositionBlock): string {
  return [`## ${markdownText(block.title)}`, ...block.nodes.map(nodeToMarkdown)].join("\n\n");
}

/** Recover only the bounded plain-text field. Invalid nodes never reach the renderer. */
export function compositionFallbackMarkdown(raw: Record<string, unknown>): string {
  const fallback =
    typeof raw.fallback === "string" ? raw.fallback.slice(0, MAX_FALLBACK_LENGTH).trim() : "";

  return fallback ? markdownText(fallback) : "_Structured response unavailable._";
}
