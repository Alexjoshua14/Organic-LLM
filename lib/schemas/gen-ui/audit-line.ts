import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const AuditLineEventSchema = z.object({
  /** Display or ISO timestamp — shown as provided; not re-parsed. */
  time: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  summary: z.string().min(1),
});

/**
 * Timeline + audit log of an iteration (state changes over time).
 * Host may supply events from chat history; heavy crawl can run in an agent sandbox.
 */
export const AuditLineBlockSchema = z.object({
  type: z.literal("audit-line"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  events: z.array(AuditLineEventSchema).min(1).max(40),
  footnote: optionalStringCatch(),
});

export type AuditLineBlock = z.infer<typeof AuditLineBlockSchema>;
export type AuditLineEvent = z.infer<typeof AuditLineEventSchema>;

export function auditLineToMarkdown(block: AuditLineBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  for (const e of block.events) {
    lines.push(`- **${e.time}** · ${e.actor} · \`${e.action}\` — ${e.summary}`);
  }
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function auditLineToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Audit";

  return `## ${title}\n\n_(Audit line — structured view unavailable)_`;
}
