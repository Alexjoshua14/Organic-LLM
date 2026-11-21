import { z } from "zod";

import { MeasureToneSchema } from "./measure";
import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const HypGraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Visual tone — never freeform color; maps to design tokens. */
  tone: MeasureToneSchema.default("accent"),
  detail: optionalStringCatch(),
});

export const HypGraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  /** Optional edge weight / confidence in \[0, 1\]. */
  weight: z.number().min(0).max(1).optional(),
  label: optionalStringCatch(),
});

/**
 * Mini interactive causal / hypothesis graph: nodes + directed edges.
 * Host may bind `onSelectNode`; heavy LLM→graph parse can run in an agent sandbox.
 */
export const HypGraphBlockSchema = z
  .object({
    type: z.literal("hyp-graph"),
    version: GEN_UI_VERSION,
    title: z.string().min(1),
    nodes: z.array(HypGraphNodeSchema).min(1).max(24),
    edges: z.array(HypGraphEdgeSchema).max(48),
    footnote: optionalStringCatch(),
  })
  .superRefine((block, ctx) => {
    const ids = new Set(block.nodes.map((n) => n.id));

    if (ids.size !== block.nodes.length) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes"],
        message: "node ids must be unique",
      });
    }
    block.edges.forEach((e, i) => {
      if (!ids.has(e.from)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i, "from"],
          message: `unknown node ${e.from}`,
        });
      }
      if (!ids.has(e.to)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i, "to"],
          message: `unknown node ${e.to}`,
        });
      }
    });
  });

export type HypGraphBlock = z.infer<typeof HypGraphBlockSchema>;
export type HypGraphNode = z.infer<typeof HypGraphNodeSchema>;
export type HypGraphEdge = z.infer<typeof HypGraphEdgeSchema>;

export function hypGraphToMarkdown(block: HypGraphBlock): string {
  const lines: string[] = [`## ${block.title}`, "", "### Nodes"];

  for (const n of block.nodes) {
    lines.push(`- **${n.label}** (\`${n.id}\`, ${n.tone})`);
    if (n.detail) lines.push(`  - ${n.detail}`);
  }
  lines.push("", "### Edges");
  for (const e of block.edges) {
    const weight = e.weight !== undefined ? ` · ${Math.round(e.weight * 100)}%` : "";
    const label = e.label ? ` — ${e.label}` : "";

    lines.push(`- ${e.from} → ${e.to}${weight}${label}`);
  }
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function hypGraphToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Hypothesis graph";

  return `## ${title}\n\n_(Hypothesis graph — structured view unavailable)_`;
}
