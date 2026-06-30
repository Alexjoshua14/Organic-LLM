"use client";

import { cn } from "@/lib/utils";

type FeatureHintQueueIndicatorProps = {
  index: number;
  total: number;
  className?: string;
};

/**
 * Compact queue pager — e.g. *1* | · | 3 when three tips are waiting in the burst.
 */
export function FeatureHintQueueIndicator({ index, total, className }: FeatureHintQueueIndicatorProps) {
  if (total <= 1) return null;

  const showExpanded = total <= 5;

  return (
    <p
      aria-label={`Tip ${index} of ${total}`}
      className={cn(
        "text-[10px] font-medium tabular-nums tracking-wide text-muted-foreground/80",
        className
      )}
    >
      {showExpanded ? (
        <span className="inline-flex items-center gap-1">
          {Array.from({ length: total }, (_, i) => {
            const page = i + 1;
            const active = page === index;

            return (
              <span key={page} className="inline-flex items-center gap-1">
                {i > 0 ? <span aria-hidden className="text-muted-foreground/40">·</span> : null}
                <span className={cn(active ? "text-foreground" : "text-muted-foreground/50")}>
                  {active ? `*${page}*` : page}
                </span>
              </span>
            );
          })}
        </span>
      ) : (
        <>
          <span className="text-foreground">{`*${index}*`}</span>
          <span aria-hidden> |··| </span>
          <span>{total}</span>
        </>
      )}
    </p>
  );
}
