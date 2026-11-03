"use client";

import type { SteerAction } from "../footer/steer-action";

import { Loader2 } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { PromptInputButton } from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

/**
 * Inline steer button beside send. The label collapses to screen-reader-only on a narrow
 * footer. On a condensed footer steer moves to the overflow menu instead.
 */
export function ComposerSteerButton({
  steer,
  locked = false,
}: {
  steer: SteerAction;
  /**
   * The composer is disabled or showing the sent-message shimmer. Greys out the inline button
   * only; the overflow menu item has never checked this.
   */
  locked?: boolean;
}) {
  const { showLabels } = useCoreInputControls();

  return (
    <PromptInputButton
      disabled={!steer.available || locked}
      size="dynamic-sm"
      title="Run steer on the current text (⌘ or Ctrl + Enter)"
      type="button"
      variant="ghost"
      onClick={steer.run}
    >
      {steer.pending ? <Loader2 aria-hidden className="size-4 animate-spin shrink-0" /> : null}
      <span className={cn("max-w-28 truncate text-xs", !showLabels && "sr-only")}>
        {steer.label}
      </span>
    </PromptInputButton>
  );
}
