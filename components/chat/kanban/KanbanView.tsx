"use client";

import { useCallback, useId, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { Check, Copy, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

import { KanbanColumn } from "./KanbanColumn";
import { KanbanLoadingShell } from "./KanbanLoadingShell";

import { glass } from "@/components/design-system/primitives";
import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { groupViewItems, selectViewItems } from "@/lib/kanban/select-view";
import { useKanbanBoard } from "@/lib/kanban/store";
import { kanbanViewToMarkdown, type KanbanView as KanbanViewType } from "@/lib/schemas/kanban";
import { cn } from "@/lib/utils";

type KanbanViewProps = {
  threadId: string;
  view: KanbanViewType;
};

export function KanbanView({ threadId, view }: KanbanViewProps) {
  const board = useKanbanBoard(threadId);
  const [copied, setCopied] = useState(false);
  const layoutGroupId = useId();

  const handleCopy = useCallback(async () => {
    const ok = await copyTextToClipboard(kanbanViewToMarkdown(view));

    if (!ok) {
      toast.error("Failed to copy");

      return;
    }
    setCopied(true);
    toast.success("Copied view as markdown");
    setTimeout(() => setCopied(false), 2000);
  }, [view]);

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
          <button
            type="button"
            aria-label="Copy view as markdown"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-background-tertiary/60 hover:text-foreground"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>

        {view.summary ? (
          <p className="px-3 pt-3 text-xs text-muted-foreground">{view.summary}</p>
        ) : null}

        {/* No top padding here: sticky column headers must pin flush to the scroll edge. */}
        <motion.div layoutScroll className="max-h-[60vh] overflow-auto px-3 pb-3">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing matches this view yet.
            </p>
          ) : (
            // Columns never wrap into rows; a squeezed board scrolls sideways instead.
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
