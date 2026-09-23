"use client";

/**
 * Pre-Presence production board, kept for the Ergon lab's "Before" section only.
 */

import type { KanbanView as KanbanViewType } from "@/lib/schemas/kanban";

import { LayoutGroup, motion } from "framer-motion";
import { useId } from "react";
import { LayoutGrid } from "lucide-react";

import { KanbanColumn } from "@/components/chat/kanban/KanbanColumn";
import { KanbanLoadingShell } from "@/components/chat/kanban/KanbanLoadingShell";
import { glass } from "@/components/design-system/primitives";
import { groupViewItems, selectViewItems } from "@/lib/kanban/select-view";
import { useKanbanBoard } from "@/lib/kanban/store";
import { cn } from "@/lib/utils";

export function LegacyKanbanView({ threadId, view }: { threadId: string; view: KanbanViewType }) {
  const board = useKanbanBoard(threadId);
  const layoutGroupId = useId();

  if (!board || board.status === "initializing") {
    return <KanbanLoadingShell title={board?.meta.title ?? view.title} />;
  }

  const items = selectViewItems(board, view);
  const groups = groupViewItems(items, view);

  return (
    <LayoutGroup id={layoutGroupId}>
      <div
        className={cn(
          glass({ opaque: true }),
          "not-prose overflow-hidden rounded-lg border border-border/50"
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutGrid className="size-3" />
              {board.meta.title}
            </span>
            <p className="truncate text-sm font-medium text-foreground">{view.title}</p>
          </div>
        </div>

        {view.summary ? (
          <p className="px-3 pt-3 text-xs text-muted-foreground">{view.summary}</p>
        ) : null}

        <motion.div layoutScroll className="max-h-[60vh] overflow-auto px-3 pb-3">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing matches this view yet.
            </p>
          ) : (
            <div className="grid auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-3 pt-3">
              {groups.map((group) => (
                <KanbanColumn key={group.key} group={group} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </LayoutGroup>
  );
}
