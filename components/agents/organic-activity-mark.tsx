"use client";

import type { AgentDotState } from "./agent-dot-grid";
import type { ActivityGlassByState } from "./activity-mark-glass";
import type { GlassDistortionSettings } from "@/components/design-system/glass-backdrop";

import { useRef } from "react";

import { AdaptiveAgentDotGrid } from "./adaptive-agent-dot-grid";
import { AgentDotGrid } from "./agent-dot-grid";
import { activityGlassForState } from "./activity-mark-glass";
import { activityBackgroundFilter, MorphActivityGlass } from "./morph-activity-glass";

import { GlassBackdrop } from "@/components/design-system/glass-backdrop";
import { cn } from "@/lib/utils";

export type OrganicActivityMarkProps = {
  state?: AgentDotState;
  size?: "sm" | "md" | "lg";
  seed?: string;
  label?: string;
  className?: string;
  /** Select the original grid for comparisons; auto keeps all adaptive safeguards. */
  renderer?: "auto" | "v0";
  /** Per-state material tuning; the glass always follows the same state as the dots. */
  glassByState?: ActivityGlassByState;
  /** Static refraction of the dot/image layer beneath the cover; on by default for agents. */
  glassDistortion?: boolean;
  /** Bounded strength, frequency and smoothness for optional refraction. */
  glassDistortionSettings?: Partial<GlassDistortionSettings>;
  /** Opt-in prototype profiling group; ordinary marks incur no per-instance timing. */
  performanceId?: string;
  /** Compatibility with existing stored identity images, inside the lower layer. */
  imageUrl?: string | null;
};

const SIZE_CLASS = { sm: "size-8", md: "size-10", lg: "size-14" } as const;

/** Owns the local stack and all layer behavior; callers only supply state and dimensions. */
export function OrganicActivityMark({
  state = "idle",
  size = "md",
  seed,
  label,
  className,
  renderer = "auto",
  glassByState,
  glassDistortion = true,
  glassDistortionSettings,
  performanceId,
  imageUrl,
}: OrganicActivityMarkProps) {
  const appearance = activityGlassForState(state, glassByState);
  const backdropRef = useRef<HTMLDivElement>(null);
  // Keep React's baseline stable while the cover writes the live spring pose.
  const initialAppearance = useRef(appearance).current;

  return (
    <div
      data-activity-state={state}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        SIZE_CLASS[size],
        "relative isolate shrink-0 overflow-hidden rounded-lg",
        className
      )}
      role={label ? "img" : undefined}
    >
      <div
        ref={backdropRef}
        className="organic-activity-backdrop pointer-events-none absolute inset-0"
        data-activity-layer="backdrop"
        data-activity-state={state}
        style={{ zIndex: 0, filter: activityBackgroundFilter(initialAppearance) }}
      >
        <GlassBackdrop
          className="absolute inset-0"
          data-activity-layer="base"
          data-activity-state={state}
          distortion={glassDistortion}
          distortionSettings={glassDistortionSettings}
          style={{ zIndex: 0 }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- may be file://, data:, or remote
            <img alt="" className="size-full object-cover" src={imageUrl} />
          ) : renderer === "v0" ? (
            <AgentDotGrid seed={seed} state={state} />
          ) : (
            <AdaptiveAgentDotGrid performanceId={performanceId} seed={seed} state={state} />
          )}
        </GlassBackdrop>
        <div
          aria-hidden
          className="organic-activity-grain pointer-events-none absolute inset-0 rounded-[inherit]"
          data-activity-layer="noise"
          data-activity-state={state}
          style={{ zIndex: 1 }}
        />
      </div>
      <MorphActivityGlass
        appearance={appearance}
        backdropRef={backdropRef}
        performanceId={performanceId}
        state={state}
      />
    </div>
  );
}

export type { AgentDotState };
export type { ActivityGlassAppearance, ActivityGlassByState } from "./activity-mark-glass";
export type { GlassDistortionSettings };
