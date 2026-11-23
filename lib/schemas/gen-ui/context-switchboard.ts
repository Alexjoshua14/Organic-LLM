import { z } from "zod";

import { GEN_UI_VERSION, optionalStringCatch } from "./shared";

export const ContextSwitchKindSchema = z.enum(["memory", "file", "assumption", "other"]);

export const ContextSwitchItemSchema = z.object({
  id: z.string().min(1),
  kind: ContextSwitchKindSchema,
  label: z.string().min(1),
  detail: optionalStringCatch(),
  /** When false, the item starts toggled off. */
  included: z.boolean().default(true),
});

/**
 * Context Switchboard: which memories, files, and assumptions shaped an answer.
 * Host `onRerun` receives the set still included after the user toggles items.
 */
export const ContextSwitchboardBlockSchema = z.object({
  type: z.literal("context-switchboard"),
  version: GEN_UI_VERSION,
  title: z.string().min(1),
  /** The claim or answer under examination. */
  question: optionalStringCatch(),
  items: z.array(ContextSwitchItemSchema).min(1).max(24),
  footnote: optionalStringCatch(),
});

export type ContextSwitchboardBlock = z.infer<typeof ContextSwitchboardBlockSchema>;
export type ContextSwitchItem = z.infer<typeof ContextSwitchItemSchema>;
export type ContextSwitchKind = z.infer<typeof ContextSwitchKindSchema>;

export function contextSwitchboardToMarkdown(block: ContextSwitchboardBlock): string {
  const lines: string[] = [`## ${block.title}`, ""];

  if (block.question) lines.push(`_${block.question}_`, "");
  for (const item of block.items) {
    const mark = item.included ? "[x]" : "[ ]";

    lines.push(`- ${mark} **${item.label}** (${item.kind})`);
    if (item.detail) lines.push(`  - ${item.detail}`);
  }
  if (block.footnote) lines.push("", `_${block.footnote}_`);

  return lines.join("\n").trim();
}

export function contextSwitchboardToMarkdownLoose(raw: Record<string, unknown>): string {
  const title = typeof raw.title === "string" ? raw.title : "Context";

  return `## ${title}\n\n_(Context switchboard — structured view unavailable)_`;
}
