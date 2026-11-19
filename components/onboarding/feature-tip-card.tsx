"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

type FeatureTipCardProps = {
  titleId: string;
  bodyId: string;
  title: string;
  body: string;
  onGotIt: () => void;
  onTurnOff: () => void;
  className?: string;
};

/**
 * The tip's content: title, one short paragraph, and two actions. One surface and one padding;
 * the only close control is "Got it" (Escape also works). The surface itself comes from the
 * popover content in `FeatureTipLayer`.
 */
export function FeatureTipCard({
  titleId,
  bodyId,
  title,
  body,
  onGotIt,
  onTurnOff,
  className,
}: FeatureTipCardProps) {
  return (
    <div className={cn("flex flex-col gap-stack-sm", className)}>
      <p
        className="flex items-start gap-inline-sm text-sm font-medium leading-snug text-foreground"
        id={titleId}
      >
        <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-lumen" strokeWidth={1.75} />
        <span>{title}</span>
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground" id={bodyId}>
        {body}
      </p>
      <div className="mt-stack-xs flex items-center justify-between gap-inline-sm">
        <Button
          className="h-11 px-2 text-xs font-normal text-muted-foreground hover:text-foreground sm:h-8"
          size="sm"
          type="button"
          variant="ghost"
          onClick={onTurnOff}
        >
          Turn off tips
        </Button>
        <Button className="h-11 px-4 sm:h-8" size="sm" type="button" onClick={onGotIt}>
          Got it
        </Button>
      </div>
    </div>
  );
}
