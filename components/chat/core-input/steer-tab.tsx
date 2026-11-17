"use client";

import type { ReactNode } from "react";
import type { SteerAction } from "./footer/steer-action";

import { ComposerSteerButton, TuneGlyph } from "./controls/steer-button";

import { glassPreview } from "@/components/design-system/primitives";
import { FeatureHint } from "@/components/onboarding/feature-hint";
import { CoreInputVoiceDrawerSlot } from "@/components/voice/core-input-voice-drawer-slot";
import { VOICE_BAR_HEIGHT_PX, VOICE_BAR_TUCK_PX } from "@/components/voice/voice-live-bar-timing";
import { cn } from "@/lib/utils";

/**
 * The strip above the compact composer. It is one row with two cells: the live voice bar's
 * drawer (which grows to fill the row) and the steer tab at the right end. Both are the same
 * height, share a glass material and are tucked the same depth behind the composer, so a call
 * starting just slides the bar in beside the tab.
 *
 * The row's height is fixed by the bar's, so the bar appearing never moves the page.
 */
export function CoreInputStrip({
  children,
  includePending = false,
}: {
  /** The tab cell, at the right end. */
  children: ReactNode;
  /** Passed through to the voice drawer slot. */
  includePending?: boolean;
}) {
  return (
    <div
      className="core-input-strip"
      style={{ height: VOICE_BAR_HEIGHT_PX, marginBottom: -VOICE_BAR_TUCK_PX }}
    >
      <CoreInputVoiceDrawerSlot inline includePending={includePending} />
      {children}
    </div>
  );
}

/**
 * A tab at the end of the strip: secondary actions that act on the draft without sending it.
 * It sits one step lower than the composer, so the composer shell overlaps its bottom edge (see
 * `.core-input-tab` in `compact.css`), and uses the same material as the live bar's fallback.
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
      className={cn(
        glassPreview({ depth: "floating", border: "all" }),
        "core-input-tab",
        className
      )}
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
  /** Anchor the first-run "Tune" coachmark on the button, as the desktop footer does. */
  showFeatureHint?: boolean;
  /** Holds the coachmark until Noesis assist is available. */
  featureHintShowWhen?: boolean;
}) {
  const button = (
    <ComposerSteerButton
      labelClassName="text-2xs"
      icon={<TuneGlyph />}
      locked={locked}
      steer={steer}
      showLabel
    />
  );

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
