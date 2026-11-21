import { z } from "zod";

import { GEN_UI_VERSION, httpUrl, optionalStringCatch } from "./shared";

export const ErgonStateTypeSchema = z.enum(["backlog", "ready", "active", "review", "done"]);

export const ErgonPrioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]);

export const ErgonWorkSourceSchema = z.enum(["todo", "ticket"]);

export const ErgonWorkItemSchema = z.object({
  /** Task uuid or ticket id (e.g. COA-123). */
  id: z.string().min(1),
  source: ErgonWorkSourceSchema,
  title: z.string().min(1),
  /** Display name, e.g. "In Progress". */
  state: z.string().min(1),
  stateType: ErgonStateTypeSchema,
  priority: ErgonPrioritySchema.default("none"),
  /** Category or project. */
  group: optionalStringCatch(),
  due: optionalStringCatch(),
  planned: optionalStringCatch(),
  estMinutes: z.number().int().positive().optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
  assignee: optionalStringCatch(),
  notes: optionalStringCatch(),
  href: httpUrl().optional().catch(undefined),
});

export const ErgonBoardColumnSchema = z.object({
  id: ErgonStateTypeSchema,
  label: z.string().min(1),
});

export const ErgonBoardBlockSchema = z
  .object({
    type: z.literal("ergon-board"),
    version: GEN_UI_VERSION,
    title: z.string().min(1),
    columns: z.array(ErgonBoardColumnSchema).min(1).max(5),
    items: z.array(ErgonWorkItemSchema).max(60),
    activeColumn: ErgonStateTypeSchema.optional(),
    footnote: optionalStringCatch(),
  })
  .superRefine((block, ctx) => {
    const cols = new Set(block.columns.map((c) => c.id));

    block.items.forEach((item, i) => {
      if (!cols.has(item.stateType)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "stateType"],
          message: "no matching column",
        });
      }
    });
  });

export const ErgonChangeSchema = z.object({
  id: z.string().min(1),
  op: z.enum(["create", "update", "complete", "comment"]),
  /** Existing item for update/complete/comment. */
  targetId: optionalStringCatch(),
  title: z.string().min(1),
  fields: z
    .array(
      z.object({
        name: z.string().min(1),
        from: optionalStringCatch(),
        to: z.string().min(1),
      })
    )
    .max(8)
    .default([]),
});

export const ErgonProposalBlockSchema = z.object({
  type: z.literal("ergon-proposal"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  source: ErgonWorkSourceSchema,
  changes: z.array(ErgonChangeSchema).min(1).max(12),
});

export type ErgonStateType = z.infer<typeof ErgonStateTypeSchema>;
export type ErgonPriority = z.infer<typeof ErgonPrioritySchema>;
export type ErgonWorkItem = z.infer<typeof ErgonWorkItemSchema>;
export type ErgonBoardBlock = z.infer<typeof ErgonBoardBlockSchema>;
export type ErgonChange = z.infer<typeof ErgonChangeSchema>;
export type ErgonProposalBlock = z.infer<typeof ErgonProposalBlockSchema>;

export function ergonBoardToMarkdown(block: ErgonBoardBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  for (const column of block.columns) {
    const items = block.items.filter((item) => item.stateType === column.id);

    lines.push(`### ${column.label} (${items.length})`, "");
    for (const item of items) {
      const meta = [item.source === "ticket" ? item.id : "todo", item.priority, item.group]
        .filter(Boolean)
        .join(" · ");

      lines.push(`- **${item.title}** (${meta})`);
      if (item.notes) lines.push(`  - ${item.notes}`);
    }
    lines.push("");
  }

  if (block.footnote) lines.push(`_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function ergonBoardToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Ergon board";

  return `## ${title}\n\n_(Ergon board — structured view unavailable)_`;
}

export function ergonProposalToMarkdown(block: ErgonProposalBlock): string {
  const lines: string[] = [`## ${block.title}`, "", `Source: ${block.source}`, ""];

  for (const change of block.changes) {
    lines.push(
      `- **${change.op}**${change.targetId ? ` · ${change.targetId}` : ""} — ${change.title}`
    );
    for (const field of change.fields) {
      const from = field.from !== undefined ? `${field.from} → ` : "";

      lines.push(`  - ${field.name}: ${from}${field.to}`);
    }
  }

  return lines.join("\n").trim();
}

export function ergonProposalToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Ergon proposal";

  return `## ${title}\n\n_(Ergon proposal — structured view unavailable)_`;
}
