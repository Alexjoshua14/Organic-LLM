"use client";

import type { KanbanActivity } from "./living/living-light";
import type { ReactNode } from "react";
import type { KanbanView as KanbanViewType } from "@/lib/schemas/kanban";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { useKanbanActivity } from "./living/activity-store";
import { LivingBoard } from "./living/LivingBoard";
import { IDLE_ACTIVITY } from "./living/living-light";

import { copyTextToClipboard } from "@/lib/clipboard/copy";
import { useKanbanBoard } from "@/lib/kanban/store";
import { kanbanViewToMarkdown } from "@/lib/schemas/kanban";

type KanbanViewProps = {
  threadId: string;
  view: KanbanViewType;
  /** Override Presence activity; defaults to the thread's in-flight tool signal. */
  activity?: KanbanActivity;
  followChanges?: boolean;
  className?: string;
};

/**
 * Production Ergon board: Presence living board driven by the thread store.
 * Copy stays in the header; motion and light live in LivingBoard.
 */
export function KanbanView({
  threadId,
  view,
  activity: activityProp,
  followChanges = true,
  className,
}: KanbanViewProps) {
  const board = useKanbanBoard(threadId);
  const storeActivity = useKanbanActivity(threadId);
  const activity = activityProp ?? storeActivity;
  const [copied, setCopied] = useState(false);

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

  const actions: ReactNode =
    board && board.status !== "initializing" ? (
      <button
        type="button"
        aria-label="Copy view as markdown"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-background-tertiary/60 hover:text-foreground"
        onClick={() => void handleCopy()}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    ) : null;

  return (
    <LivingBoard
      activity={activity}
      board={board}
      className={className}
      followChanges={followChanges}
      headerActions={actions}
      light="presence"
      view={view}
    />
  );
}

export type { KanbanActivity };
export { IDLE_ACTIVITY };
