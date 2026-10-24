"use client";

import { ShieldCheck } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { cn } from "@/lib/utils";

type ModelZdrIndicatorProps = {
  className?: string;
};

export function ModelZdrIndicator({ className }: ModelZdrIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label="Zero data retention"
          className={cn("inline-flex shrink-0 items-center text-muted-foreground", className)}
        >
          <ShieldCheck aria-hidden="true" className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="w-fit max-w-48" side="top">
        Zero Data Retention is available for this model through AI Gateway.
      </TooltipContent>
    </Tooltip>
  );
}
