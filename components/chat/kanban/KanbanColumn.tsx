"use client";

import type { KanbanColumnGroup } from "@/lib/kanban/select-view";

import { AnimatePresence } from "framer-motion";

import { KanbanCard } from "./KanbanCard";

export function KanbanColumn({ group }: { group: KanbanColumnGroup }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded bg-background-tertiary/90 px-0.5 py-1 backdrop-blur-md">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {group.label}
        </span>
        <span className="rounded-full bg-background-tertiary/60 px-1.5 text-[10px] font-medium text-muted-foreground">
          {group.items.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {group.items.map((item) => (
            <KanbanCard key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
