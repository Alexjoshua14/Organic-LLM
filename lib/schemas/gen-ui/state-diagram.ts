import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const StateDiagramStateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const StateDiagramTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: optionalStringCatch(),
});

/** Simple state diagram: model supplies states and edges; no layout engine. */
export const StateDiagramBlockSchema = z
  .object({
    type: z.literal("state-diagram"),
    version: GEN_UI_VERSION,
    title: z.string().min(1),
    states: z.array(StateDiagramStateSchema).min(1).max(24),
    transitions: z.array(StateDiagramTransitionSchema).max(48),
    footnote: optionalStringCatch(),
  })
  .superRefine((block, ctx) => {
    const ids = new Set(block.states.map((s) => s.id));

    block.transitions.forEach((t, i) => {
      if (!ids.has(t.from)) {
        ctx.addIssue({
          code: "custom",
          path: ["transitions", i, "from"],
          message: `unknown state ${t.from}`,
        });
      }
      if (!ids.has(t.to)) {
        ctx.addIssue({
          code: "custom",
          path: ["transitions", i, "to"],
          message: `unknown state ${t.to}`,
        });
      }
    });
  });

export type StateDiagramBlock = z.infer<typeof StateDiagramBlockSchema>;
export type StateDiagramState = z.infer<typeof StateDiagramStateSchema>;
export type StateDiagramTransition = z.infer<typeof StateDiagramTransitionSchema>;

export function stateDiagramToMarkdown(block: StateDiagramBlock): string {
  const lines: string[] = [`## ${block.title}`, "", "### States"];

  for (const s of block.states) lines.push(`- **${s.label}** (\`${s.id}\`)`);
  lines.push("", "### Transitions");
  for (const t of block.transitions) {
    const label = t.label ? ` — ${t.label}` : "";

    lines.push(`- ${t.from} → ${t.to}${label}`);
  }
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function stateDiagramToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "State diagram";

  return `## ${title}\n\n_(State diagram — structured view unavailable)_`;
}
