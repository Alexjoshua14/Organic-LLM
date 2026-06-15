"use client";

import type { AudioSnippetBlock } from "@/lib/schemas/gen-ui";

import { Play } from "lucide-react";

import { calculateTokenUsage } from "@/lib/tts/token-calculator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";
import { cn } from "@/lib/utils";

type AudioSnippetProps = {
  block: AudioSnippetBlock;
  partial?: boolean;
};

export function AudioSnippet({ block, partial }: AudioSnippetProps) {
  const cost = calculateTokenUsage(block.script, "eleven_flash_v2_5");
  const costLabel =
    cost.estimatedCost < 0.01
      ? `~$${cost.estimatedCost.toFixed(3)}`
      : `~$${cost.estimatedCost.toFixed(2)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              aria-label="Generate audio (Phase 2)"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50",
                "bg-background-tertiary/40 text-muted-foreground cursor-not-allowed opacity-60"
              )}
            >
              <Play className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Audio generation — Phase 2</TooltipContent>
        </Tooltip>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-sm text-foreground">
            {partial && !block.preview.title ? (
              <span className="inline-block h-4 w-48 rounded bg-muted/40 animate-pulse" />
            ) : (
              block.preview.title
            )}
          </p>
          <p className="text-sm text-muted-foreground leading-snug">{block.preview.teaser}</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {block.preview.duration ? <span>{block.preview.duration}</span> : null}
            {block.meta?.tone ? <span>· {block.meta.tone}</span> : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted underline-offset-2">
                  Est. cost {costLabel}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Based on script length ({cost.characterCount} chars) at flash rates. Billed when you
                generate in Phase 2.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <details className="rounded-lg border border-border/40 bg-background-tertiary/15 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          View script
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs text-foreground font-mono">
          {block.script}
        </pre>
      </details>
    </div>
  );
}
