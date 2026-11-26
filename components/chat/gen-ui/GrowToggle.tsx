"use client";

import { GEN_UI_FOCUS } from "./interaction";

import { cn } from "@/lib/utils";

/**
 * Gen UI's one way to reveal more: a plain text row at the end of the content it extends, so the
 * extra items continue the same list instead of opening a separate block under a chevron or a
 * disclosure triangle. Pair it with rendering the hidden items in place when `expanded`.
 */
export function GrowToggle({
  expanded,
  onToggle,
  more,
  label,
  className,
}: {
  expanded: boolean;
  onToggle: () => void;
  /** Count still hidden; the default label reads "Show N more". */
  more?: number;
  /** Collapsed label when a count does not describe it (e.g. "Show ingredients & method"). */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className={cn(
        GEN_UI_FOCUS,
        "flex min-h-11 w-full items-center text-left text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {expanded ? "Show less" : (label ?? `Show ${more ?? ""} more`.replace("  ", " "))}
    </button>
  );
}
