"use client";

import type { SteerAction } from "../footer/steer-action";

import { Loader2 } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { PromptInputButton } from "@/components/third-party/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

/**
 * Steer button. On the desktop footer it sits beside send, and the label collapses to
 * screen-reader-only on a narrow footer. On a condensed composer it lives in the tab above the
 * composer (`steer-tab.tsx`) with its label shown.
 */
export function ComposerSteerButton({
  steer,
  locked = false,
  showLabel = false,
}: {
  steer: SteerAction;
  /**
   * The composer is disabled or showing the sent-message shimmer. Greys out the button. The
   * overflow menu item (used only if a placement says `"menu"`) has never checked this.
   */
  locked?: boolean;
  /** Keep the label visible regardless of the footer width (the compact steer tab). */
  showLabel?: boolean;
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
      <span className={cn("max-w-28 truncate text-xs", !(showLabels || showLabel) && "sr-only")}>
        {steer.label}
      </span>
    </PromptInputButton>
  );
}
