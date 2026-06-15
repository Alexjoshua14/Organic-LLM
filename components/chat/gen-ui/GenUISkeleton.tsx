"use client";

import type { GenUIBlockType } from "@/lib/schemas/gen-ui";

import { cn } from "@/lib/utils";
import { glass } from "@/components/design-system/primitives";

type GenUISkeletonProps = {
  type?: GenUIBlockType;
  partialInput?: Record<string, unknown>;
};

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("rounded bg-muted/50 animate-pulse", className)} />;
}

export function GenUISkeleton({ type, partialInput }: GenUISkeletonProps) {
  const title =
    typeof partialInput?.title === "string"
      ? partialInput.title
      : typeof partialInput?.question === "string"
        ? partialInput.question
        : typeof partialInput?.preview === "object" &&
            partialInput.preview &&
            typeof (partialInput.preview as Record<string, unknown>).title === "string"
          ? ((partialInput.preview as Record<string, unknown>).title as string)
          : null;

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "not-prose rounded-lg border border-border/50 px-3 py-3 space-y-3"
      )}
      aria-busy
      aria-label="Loading structured response"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <Shimmer className="h-2.5 w-16" />
          {title ? (
            <p className="text-sm font-medium text-foreground truncate">{title}</p>
          ) : (
            <Shimmer className="h-4 w-3/4 max-w-xs" />
          )}
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
          {type ? type.replace(/-/g, " ") : "Structuring…"}
        </span>
      </div>

      {type === "decision-matrix" ? (
        <div className="grid gap-2">
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-full" />
          <Shimmer className="h-8 w-5/6" />
        </div>
      ) : null}

      {type === "plan-timeline" ? (
        <div className="space-y-3 pl-2 border-l border-border/40">
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
          <Shimmer className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-2/3" />
            <Shimmer className="h-3 w-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
