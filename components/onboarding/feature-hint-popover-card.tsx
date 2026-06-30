"use client";

import { Sparkles, X } from "lucide-react";

import { ExperienceSurfacesGuide } from "./experience-surfaces-guide";
import { FeatureHintQueueIndicator } from "./feature-hint-queue-indicator";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

type FeatureHintPopoverCardProps = {
  hintId: string;
  title: string;
  body: string;
  onDismiss: () => void;
  className?: string;
  queueIndex?: number;
  queueTotal?: number;
};

export function FeatureHintPopoverCard({
  hintId,
  title,
  body,
  onDismiss,
  className,
  queueIndex,
  queueTotal,
}: FeatureHintPopoverCardProps) {
  return (
    <div
      aria-labelledby={`feature-hint-${hintId}-title`}
      className={cn(
        glass({ opaque: true }),
        "rounded-xl p-3.5 sm:p-4 shadow-xl",
        className
      )}
      role="dialog"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          {queueIndex != null && queueTotal != null ? (
            <FeatureHintQueueIndicator index={queueIndex} total={queueTotal} />
          ) : null}
          <div className="flex min-w-0 items-start gap-2">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-lumen" />
            <p
              className="text-sm font-medium leading-snug text-foreground"
              id={`feature-hint-${hintId}-title`}
            >
              {title}
            </p>
          </div>
        </div>
        <Button
          aria-label="Dismiss tip"
          className="size-7 shrink-0 text-muted-foreground"
          size="icon"
          type="button"
          variant="ghost"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {hintId === "experience-rail" ? (
        <>
          <p className="mb-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{body}</p>
          <ExperienceSurfacesGuide onDismiss={onDismiss} />
        </>
      ) : (
        <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">{body}</p>
      )}
      <Button className="h-9 w-full text-xs sm:text-sm" size="sm" type="button" onClick={onDismiss}>
        Got it
      </Button>
    </div>
  );
}
