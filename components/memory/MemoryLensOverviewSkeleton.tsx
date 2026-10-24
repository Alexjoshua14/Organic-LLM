"use client";

import { cn } from "@/lib/utils";

/** Matches overview text region min-height to limit layout shift (about five lines at text-sm). */
export function MemoryLensOverviewSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2 w-full min-h-[6.25rem]", className)}>
      <div className="h-3.5 w-full max-w-[95%] rounded bg-muted/45 animate-pulse" />
      <div className="h-3.5 w-full max-w-[88%] rounded bg-muted/40 animate-pulse" />
      <div className="h-3.5 w-full max-w-[92%] rounded bg-muted/35 animate-pulse" />
      <div className="h-3.5 w-full max-w-[70%] rounded bg-muted/35 animate-pulse" />
      <div className="h-3.5 w-full max-w-[55%] rounded bg-muted/30 animate-pulse" />
    </div>
  );
}
