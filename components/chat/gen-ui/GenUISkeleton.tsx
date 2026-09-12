"use client";

import type { GenUIBlockType } from "@/lib/schemas/gen-ui";

import { cn } from "@/lib/utils";

type GenUISkeletonProps = {
  type?: GenUIBlockType;
  partialInput?: Record<string, unknown>;
};

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("rounded bg-muted/50 animate-pulse", className)} />;
}

export function GenUISkeleton({ type }: GenUISkeletonProps) {
  return (
    <div className="not-prose space-y-3" aria-busy aria-label="Loading structured response">
      {type === "decision-matrix" ? (
        <div className="grid gap-2">
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-5/6" />
        </div>
      ) : null}

      {type === "plan-timeline" ? (
        <div className="space-y-3 border-l border-border/40 pl-2">
          <Shimmer className="h-10 w-full" />
          <Shimmer className="h-6 w-4/5" />
          <Shimmer className="h-6 w-3/5" />
        </div>
      ) : null}

      {type === "answer-card" || !type ? (
        <div className="space-y-2">
          <Shimmer className="h-12 w-full" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-11/12" />
          <Shimmer className="h-3 w-10/12" />
        </div>
      ) : null}

      {type === "audio-snippet" ? (
        <div className="flex gap-3">
          <Shimmer className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-2/3" />
            <Shimmer className="h-3 w-full" />
          </div>
        </div>
      ) : null}

      {type === "recipe-card" || type === "shopping-list" ? (
        <div className="space-y-2">
          <Shimmer className="h-4 w-2/3" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
        </div>
      ) : null}

      {type === "restaurant-card" ? (
        <div className="flex gap-3">
          <Shimmer className="size-16 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2 py-1">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/3" />
            <Shimmer className="h-3 w-1/2" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
