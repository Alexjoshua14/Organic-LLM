"use client";

import { cn } from "@/lib/utils";

/**
 * The list's master light: how many sessions hold new content, and how many are working. Only
 * "new" is actionable — it jumps to the next lit row, so nothing unread hides below the fold.
 * Renders nothing when there is nothing to report, and sits in the group label so its arrival
 * never shifts the rows.
 */
export function SidebarAttentionSummary({
  unseen,
  working,
  onJumpToNew,
  className,
}: {
  unseen: number;
  working: number;
  onJumpToNew: () => void;
  className?: string;
}) {
  if (unseen === 0 && working === 0) return null;

  return (
    <div
      className={cn(
        "ml-auto flex items-center gap-2 text-2xs font-normal tabular-nums tracking-wide",
        className
      )}
    >
      {working > 0 ? <span className="text-muted-foreground">{working} working</span> : null}
      {unseen > 0 ? (
        <button
          aria-label={`Jump to the next thread with new activity (${unseen} total)`}
          className="cursor-pointer rounded px-1 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
          type="button"
          onClick={(event) => {
            // The label row can also toggle its collapsible group.
            event.stopPropagation();
            onJumpToNew();
          }}
        >
          {unseen} new
        </button>
      ) : null}
    </div>
  );
}
