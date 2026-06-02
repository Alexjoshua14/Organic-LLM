import { z } from "zod";

import { KanbanCommandSchema, type KanbanCommand } from "./command";
import { isKanbanCommandType, KANBAN_STATUS_LABELS, type KanbanCommandType } from "./shared";
import { KanbanViewSchema, type KanbanView } from "./view";

export * from "./shared";
export * from "./item";
export * from "./view";
export * from "./command";

/** Tool output for a mutation command (no UI block; board updates via the data channel). */
export const KanbanAckOutputSchema = z.object({
  kind: z.literal("kanban-ack"),
  applied: z.enum(["INITIATE_KANBAN", "UPSERT_ITEMS", "UPDATE_ITEM", "MOVE_ITEM", "REMOVE_ITEM"]),
  count: z.number().int().optional(),
});

/** Tool output for SHOW_VIEW — anchors a `KanbanView` in the thread. */
export const KanbanViewOutputSchema = z.object({
  kind: z.literal("kanban-view"),
  view: KanbanViewSchema,
});

export const KanbanBoardToolOutputSchema = z.union([KanbanAckOutputSchema, KanbanViewOutputSchema]);

export type KanbanAckOutput = z.infer<typeof KanbanAckOutputSchema>;
export type KanbanViewOutput = z.infer<typeof KanbanViewOutputSchema>;
export type KanbanBoardToolOutput = z.infer<typeof KanbanBoardToolOutputSchema>;

export type SafeParseKanbanCommandResult =
  | { ok: true; command: KanbanCommand }
  | { ok: false; errors: z.ZodError };

/** Defensive re-parse of a streamed command on the client. */
export function safeParseKanbanCommand(raw: unknown): SafeParseKanbanCommandResult {
  const parsed = KanbanCommandSchema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, command: parsed.data };
  }

  return { ok: false, errors: parsed.error };
}

/** Peek a streamed/partial payload for its command discriminator. */
export function peekKanbanCommandType(input: unknown): KanbanCommandType | undefined {
  if (!input || typeof input !== "object") return undefined;
  const t = (input as Record<string, unknown>).type;

  if (typeof t !== "string") return undefined;

  return isKanbanCommandType(t) ? t : undefined;
}

/** Extract a `{ kind: "kanban-view", view }` payload from raw tool output. */
export function extractKanbanViewFromToolOutput(output: unknown): KanbanView | null {
  const parsed = KanbanViewOutputSchema.safeParse(output);

  return parsed.success ? parsed.data.view : null;
}

/** Copy-friendly markdown for a saved view (recipe only; items live client-side). */
export function kanbanViewToMarkdown(view: KanbanView): string {
  const lines: string[] = [`## ${view.title}`, ""];

  if (view.summary) {
    lines.push(view.summary, "");
  }
  const facets: string[] = [`intent: ${view.intent}`];

  if (view.filter?.statuses?.length) {
    facets.push(`statuses: ${view.filter.statuses.map((s) => KANBAN_STATUS_LABELS[s]).join(", ")}`);
  }
  if (view.filter?.priorities?.length) {
    facets.push(`priorities: ${view.filter.priorities.join(", ")}`);
  }
  if (view.filter?.tags?.length) {
    facets.push(`tags: ${view.filter.tags.join(", ")}`);
  }
  lines.push(`_${facets.join(" · ")}_`);

  return lines.join("\n").trim();
}
