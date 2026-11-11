"use client";

import type { ReactNode } from "react";
import type { SteerAction } from "./footer/steer-action";

import { ComposerSteerButton } from "./controls/steer-button";

import { glass } from "@/components/design-system/primitives";
import { FeatureHint } from "@/components/onboarding/feature-hint";
import { cn } from "@/lib/utils";

/**
 * A pull tab on top of the compact CoreInput: secondary actions that act on the draft without
 * sending it. It sits one step lower than the composer, so the composer shell overlaps its
 * bottom edge (see `.core-input-tab` in `compact.css`).
 *
 * Today it holds steer only. Another secondary action is another child.
 */
export function CoreInputTab({
  children,
  label = "Draft actions",
  className,
}: {
  children: ReactNode;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(glass(), "core-input-tab", className)}
      data-core-input-tab
    >
      {children}
    </div>
  );
}

/**
 * The compact layout's steer, in the tab above the composer. The tab is present whenever the
 * surface has steer, so the draft going empty or not only toggles the button's disabled state
 * and never shifts the layout.
 */
export function CoreInputSteerTab({
  steer,
  locked = false,
  showFeatureHint = false,
  featureHintShowWhen = true,
}: {
  steer: SteerAction;
  /** The composer is disabled or showing the sent-message shimmer. */
  locked?: boolean;
  /** Anchor the first-run "Steer assist" coachmark on the button, as the desktop footer does. */
  showFeatureHint?: boolean;
  /** Holds the coachmark until Noesis assist is available. */
  featureHintShowWhen?: boolean;
}) {
  const button = <ComposerSteerButton locked={locked} steer={steer} showLabel />;

  return (
    <CoreInputTab>
      {showFeatureHint ? (
        <FeatureHint id="noesis-steer-assist" showWhen={featureHintShowWhen}>
          {button}
        </FeatureHint>
      ) : (
        button
      )}
    </CoreInputTab>
  );
}
