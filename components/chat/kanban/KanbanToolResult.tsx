"use client";

import { LayoutGrid } from "lucide-react";

import { KanbanView } from "./KanbanView";

import { KanbanBoardToolOutputSchema } from "@/lib/schemas/kanban";

const ACK_LABELS: Record<string, string> = {
  INITIATE_KANBAN: "Board initialized",
  UPSERT_ITEMS: "Board updated",
  UPDATE_ITEM: "Item updated",
  MOVE_ITEM: "Item moved",
  REMOVE_ITEM: "Item removed",
};

type KanbanToolResultProps = {
  threadId: string;
  output: unknown;
};

/** Renders the `kanban_board` tool output: a saved view, or a subtle mutation chip. */
export function KanbanToolResult({ threadId, output }: KanbanToolResultProps) {
  const parsed = KanbanBoardToolOutputSchema.safeParse(output);

  if (!parsed.success) return null;

  if (parsed.data.kind === "kanban-view") {
    return <KanbanView threadId={threadId} view={parsed.data.view} />;
  }

  const label = ACK_LABELS[parsed.data.applied] ?? "Board updated";
  const count = parsed.data.count;

  return (
    <div className="not-prose inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background-tertiary/40 px-2.5 py-1 text-xs text-muted-foreground">
      <LayoutGrid className="size-3" />
      {label}
      {typeof count === "number" && count > 0 ? ` · ${count} item${count === 1 ? "" : "s"}` : ""}
    </div>
  );
}
