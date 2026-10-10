"use client";

import type { MessageSendQueueRow } from "@/lib/schemas/message-send-queue";
import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";

import { cn } from "@/lib/utils";

function statusLabel(status: MessageSendQueueRow["status"]): string {
  switch (status) {
    case "blocked_streaming":
      return "Waiting for agent";
    case "blocked_budget":
      return "Waiting for budget";
    case "dispatching":
      return "Sending";
    case "pending":
      return "Queued";
    default:
      return status;
  }
}

/**
 * Compact strip above the composer showing multi-mode queued messages.
 */
export function MessageSendQueueStrip(props: {
  items: MessageSendQueueRow[];
  budget?: PlanBudgetSnapshot | null;
  className?: string;
}) {
  const { items, budget, className } = props;

  if (items.length === 0 && !(budget && !budget.canDispatch)) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        "w-full rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm",
        className
      )}
      role="status"
    >
      {budget && !budget.canDispatch ? (
        <p className="mb-1.5 text-amber-700 dark:text-amber-300">
          {budget.holdReason ?? "Plan budget exhausted — messages stay queued"}
        </p>
      ) : null}
      {items.length === 0 ? null : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li className="flex min-w-0 items-start gap-2" key={item.id}>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground/80">
                {statusLabel(item.status)}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground/90" title={item.body}>
                {item.body}
              </span>
              {item.hold_reason ? (
                <span className="shrink-0 max-w-[40%] truncate text-[10px] text-amber-700 dark:text-amber-300">
                  {item.hold_reason}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
