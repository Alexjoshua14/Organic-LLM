"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("rounded bg-muted/50 animate-pulse", className)} />;
}

/** Shown after INITIATE_PLAN, before the plan hydrates. */
export function MiseLoadingShell({ title }: { title?: string }) {
  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "not-prose rounded-lg border border-border/50 px-3 py-3 space-y-3"
      )}
      aria-busy
      aria-label="Preparing plan"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Remy
          </span>
          {title ? (
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
          ) : (
            <Shimmer className="h-4 w-2/3 max-w-xs" />
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Plating up…
        </span>
      </div>
      <div className="space-y-2">
        <Shimmer className="h-2.5 w-20" />
        <Shimmer className="h-12 w-full" />
        <Shimmer className="h-12 w-5/6" />
      </div>
    </div>
  );
}
