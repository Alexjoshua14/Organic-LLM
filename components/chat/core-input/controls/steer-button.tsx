"use client";

import type { ReactNode } from "react";
import type { SteerAction } from "../footer/steer-action";

import { useId } from "react";
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
  icon,
  labelClassName = "text-xs",
}: {
  steer: SteerAction;
  /**
   * The composer is disabled or showing the sent-message shimmer. Greys out the button. The
   * overflow menu item (used only if a placement says `"menu"`) has never checked this.
   */
  locked?: boolean;
  /** Keep the label visible regardless of the footer width (the compact steer tab). */
  showLabel?: boolean;
  /** Shown before the label; replaced by a spinner while a steer runs. */
  icon?: ReactNode;
  /** Text size for the label; the tab matches the live bar's `text-2xs`. */
  labelClassName?: string;
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
      {steer.pending ? <Loader2 aria-hidden className="size-4 animate-spin shrink-0" /> : icon}
      <span
        className={cn("max-w-28 truncate", labelClassName, !(showLabels || showLabel) && "sr-only")}
      >
        {steer.label}
      </span>
    </PromptInputButton>
  );
}

/**
 * A rotary dial: a solid knob with a notch for its pointer, under a 270 degree scale arc. Tune
 * adjusts how suggested replies sound, so the notch swings to a new setting when the button is
 * hovered or focused (see `.core-input-tune-needle` in `compact.css`). The notch is cut out of
 * the knob with a mask, so the knob reads as one solid piece. Decorative; the button's label
 * names the action.
 */
export function TuneGlyph({ size = 14 }: { size?: number }) {
  const maskId = `tune-notch-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden
      className="shrink-0"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id={maskId}>
        <rect fill="white" height="24" width="24" />
        <path className="core-input-tune-needle" d="M12 5.8V9.2" stroke="black" strokeWidth={2.4} />
      </mask>
      <circle cx="12" cy="12" fill="currentColor" mask={`url(#${maskId})`} r="7" stroke="none" />
      <path d="M4.58 19.42A10.5 10.5 0 1 1 19.42 19.42" opacity="0.5" strokeWidth={1.6} />
    </svg>
  );
}
