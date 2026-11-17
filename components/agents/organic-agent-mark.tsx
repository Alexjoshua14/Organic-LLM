"use client";

import type { AgentDotState } from "./agent-dot-grid";

import { OrganicActivityMark } from "./organic-activity-mark";
import { ORGANIC_HERO_MARK } from "./organic-hero-mark";

import { cn } from "@/lib/utils";

/**
 * The hero size and corner (Speak's center). The `!` modifiers stay: Stage sizes its marks with
 * unlayered CSS (`.stage-agent-mark`), which would otherwise beat these utilities.
 */
const HERO_CLASS = "!size-[clamp(7rem,24dvh,13rem)] !rounded-3xl";

export type OrganicAgentMarkProps = {
  state?: AgentDotState;
  seed?: string;
  label?: string;
  className?: string;
  /** Speak's center size and corner. Without it the caller sizes the mark through `className`. */
  hero?: boolean;
};

/**
 * Every Organic agent on a page (Speak's center, Stage's main agent and its specialists) renders
 * this, so they share one material. Callers vary only state, seed and size, never the glass.
 */
export function OrganicAgentMark({ hero = false, className, ...mark }: OrganicAgentMarkProps) {
  return (
    <OrganicActivityMark
      {...ORGANIC_HERO_MARK}
      {...mark}
      className={cn(hero && HERO_CLASS, className)}
    />
  );
}
