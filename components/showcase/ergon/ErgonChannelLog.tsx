"use client";

import type { KanbanCommand } from "@/lib/schemas/kanban";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ErgonChannelLogProps = {
  commands: readonly KanbanCommand[];
  className?: string;
};

function commandSummary(command: KanbanCommand): string {
  switch (command.type) {
    case "INITIATE_KANBAN":
      return `INITIATE · ${command.board.title}`;
    case "UPSERT_ITEMS":
      return `UPSERT · ${command.items.length} item${command.items.length === 1 ? "" : "s"}`;
    case "UPDATE_ITEM":
      return `UPDATE · ${command.id}`;
    case "MOVE_ITEM":
      return `MOVE · ${command.id} → ${command.status}`;
    case "REMOVE_ITEM":
      return `REMOVE · ${command.id}`;
    case "SHOW_VIEW":
      return `SHOW_VIEW · ${command.view.title}`;
  }
}

/** Rolling log of data-kanban commands applied during the Ergon showcase replay. */
export function ErgonChannelLog({ commands, className }: ErgonChannelLogProps) {
  return (
    <div
      className={cn("rounded-xl border border-border/50 p-3", glass({ border: "none" }), className)}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        data-kanban
      </p>
      {commands.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">Waiting for tool calls…</p>
      ) : (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto font-mono text-[11px] text-muted-foreground">
          {commands.map((command, index) => (
            <li key={`${command.type}-${index}`} className="truncate">
              <span className="text-foreground/70">{index + 1}.</span> {commandSummary(command)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
