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
    <div className="not-prose space-y-stack-md" aria-busy aria-label="Loading structured response">
      {type === "decision-matrix" ? (
        <div className="grid gap-2">
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-5/6" />
        </div>
      ) : null}

      {type === "plan-timeline" ? (
        <div className="space-y-stack-md border-l border-border/40 pl-inset-sm">
          <Shimmer className="h-10 w-full" />
          <Shimmer className="h-6 w-4/5" />
          <Shimmer className="h-6 w-3/5" />
        </div>
      ) : null}

      {type === "answer-card" || type === "research-report" || !type ? (
        <div className="space-y-stack-sm">
          <Shimmer className="h-12 w-full" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-11/12" />
          <Shimmer className="h-3 w-10/12" />
        </div>
      ) : null}

      {type === "audio-snippet" ? (
        <div className="flex gap-inline-md">
          <Shimmer className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-stack-sm">
            <Shimmer className="h-4 w-2/3" />
            <Shimmer className="h-3 w-full" />
          </div>
        </div>
      ) : null}

      {type === "recipe-card" || type === "shopping-list" ? (
        <div className="space-y-stack-sm">
          <Shimmer className="h-4 w-2/3" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
        </div>
      ) : null}

      {type === "code-diff" ? (
        <div className="space-y-stack-sm">
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-24 w-full" />
        </div>
      ) : null}

      {type === "measure" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-2/3" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
        </div>
      ) : null}

      {type === "profile-map" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-1/2" />
          <div className="flex gap-inline-sm">
            <Shimmer className="h-6 w-14 rounded-full" />
            <Shimmer className="h-6 w-16 rounded-full" />
            <Shimmer className="h-6 w-12 rounded-full" />
          </div>
          <Shimmer className="h-12 w-full rounded-xl" />
          <Shimmer className="h-12 w-full rounded-xl" />
        </div>
      ) : null}

      {type === "ergon-board" || type === "ergon-proposal" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-2/3" />
          <div className="flex gap-inline-sm">
            <Shimmer className="h-11 w-20 rounded-full" />
            <Shimmer className="h-11 w-20 rounded-full" />
          </div>
          <Shimmer className="h-14 w-full rounded-xl" />
          <Shimmer className="h-14 w-full rounded-xl" />
        </div>
      ) : null}

      {type === "state-diagram" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-1/2" />
          <div className="flex gap-inline-sm">
            <Shimmer className="size-8 rounded-full" />
            <Shimmer className="h-8 w-full" />
          </div>
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-5/6" />
        </div>
      ) : null}

      {type === "prompt-field" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-2/3" />
          <Shimmer className="h-20 w-full rounded-xl" />
          <div className="flex gap-inline-sm">
            <Shimmer className="h-8 w-16 rounded-full" />
            <Shimmer className="h-8 w-20 rounded-full" />
            <Shimmer className="h-8 w-14 rounded-full" />
          </div>
        </div>
      ) : null}

      {type === "progress-track" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-3 w-full rounded-full" />
          <div className="flex justify-between gap-inline-sm">
            <Shimmer className="h-3 w-12" />
            <Shimmer className="h-3 w-12" />
            <Shimmer className="h-3 w-12" />
          </div>
        </div>
      ) : null}

      {type === "context-switchboard" || type === "ripple-preview" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-2/3" />
          <Shimmer className="h-12 w-full rounded-xl" />
          <Shimmer className="h-12 w-full rounded-xl" />
          <Shimmer className="h-12 w-5/6 rounded-xl" />
        </div>
      ) : null}

      {type === "hyp-graph" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-12 w-full rounded-xl" />
          <Shimmer className="h-12 w-full rounded-xl" />
          <Shimmer className="h-8 w-5/6 rounded-xl" />
        </div>
      ) : null}

      {type === "audit-line" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-2/3" />
          <div className="flex gap-inline-md">
            <Shimmer className="mt-stack-xs size-2 shrink-0 rounded-full" />
            <Shimmer className="h-10 w-full" />
          </div>
          <div className="flex gap-inline-md">
            <Shimmer className="mt-stack-xs size-2 shrink-0 rounded-full" />
            <Shimmer className="h-10 w-5/6" />
          </div>
        </div>
      ) : null}

      {type === "preview-blob" ? (
        <div className="space-y-stack-md">
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-48 w-full rounded-xl" />
          <Shimmer className="h-8 w-1/3" />
        </div>
      ) : null}

      {type === "restaurant-card" ? (
        <div className="flex gap-inline-md">
          <Shimmer className="size-16 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-stack-sm py-1">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-1/3" />
            <Shimmer className="h-3 w-1/2" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
