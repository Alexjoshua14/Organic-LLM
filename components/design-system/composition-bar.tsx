"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CompositionSegment = {
  id: string;
  value: number;
  color: string;
  glowColor?: string;
  ariaLabel: string;
  title?: string;
};

type CompositionBarProps = {
  segments: CompositionSegment[];
  label: string;
  selectedId: string | null;
  onSelectionChange: (id: string | null) => void;
  variant?: "glow" | "solid";
};

/** Keeps inspection labels from shifting the content below either composition variant. */
export function CompositionBarDetail({ children }: { children: ReactNode }) {
  return (
    <div
      className="-mt-1 h-8 text-xs leading-4 text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </div>
  );
}

/** Shared composition of a whole: callers own category colors, units, and detail labels. */
export function CompositionBar({
  segments,
  label,
  selectedId,
  onSelectionChange,
  variant = "glow",
}: CompositionBarProps) {
  const visible = segments.filter((segment) => Number.isFinite(segment.value) && segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="flex h-6 w-full items-center" role="group" aria-label={label}>
      {visible.map((segment) => (
        <button
          key={segment.id}
          type="button"
          aria-label={segment.ariaLabel}
          title={segment.title ?? segment.ariaLabel}
          aria-pressed={selectedId === segment.id}
          onMouseEnter={() => onSelectionChange(segment.id)}
          onMouseLeave={() => onSelectionChange(null)}
          onFocus={() => onSelectionChange(segment.id)}
          onBlur={() => onSelectionChange(null)}
          onClick={() => onSelectionChange(segment.id)}
          className="relative h-full min-w-0 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          style={{ width: `${(segment.value / total) * 100}%` }}
        >
          <span
            className={cn(
              "pointer-events-none absolute inset-x-px top-1/2 -translate-y-1/2 rounded-full",
              variant === "glow" ? "h-1" : "h-1.5"
            )}
            style={{
              backgroundColor: segment.color,
              boxShadow:
                variant === "glow" ? `0 0 4px ${segment.glowColor ?? segment.color}` : undefined,
            }}
          >
            {variant === "glow" ? (
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rounded-full bg-white/55" />
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
