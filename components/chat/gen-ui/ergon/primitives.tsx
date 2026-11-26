"use client";

import type { ReactNode } from "react";
import type { ErgonStateType, ErgonWorkItem } from "@/lib/schemas/gen-ui";

import { cn } from "@/lib/utils";

/** Status fill per state type. Exported so condensed views can draw the same colours as bars. */
export const DOT: Record<ErgonStateType, string> = {
  backlog: "bg-muted-foreground/30",
  ready: "bg-muted-foreground/60",
  active: "bg-accent",
  review: "bg-accent-warm",
  done: "bg-accent/40",
};

/** `DOT` as CSS colour values, for the shared CompositionBar (keep the two maps in step). */
export const DOT_COLOR: Record<ErgonStateType, string> = {
  backlog: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
  ready: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  active: "var(--color-accent)",
  review: "var(--color-accent-warm)",
  done: "color-mix(in oklab, var(--accent) 40%, transparent)",
};

export const Dot = ({ type }: { type: ErgonStateType }) => (
  <span className={cn("size-2.5 shrink-0 rounded-full", DOT[type])} aria-hidden />
);

const LEVEL: Record<ErgonWorkItem["priority"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const PIP_HEIGHT = ["h-1", "h-1.5", "h-2", "h-2.5"] as const;

export function PriorityMark({ p }: { p: ErgonWorkItem["priority"] }) {
  const n = LEVEL[p];
  const hot = n >= 3;

  return (
    <span className="flex items-end gap-px" aria-label={`priority ${p}`}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-sm",
            PIP_HEIGHT[i - 1],
            i <= n ? (hot ? "bg-accent-warm" : "bg-foreground") : "bg-muted-foreground/20"
          )}
        />
      ))}
    </span>
  );
}

export const Chip = ({ children, hot = false }: { children: ReactNode; hot?: boolean }) => (
  <span
    className={cn(
      "rounded-full px-inset-sm py-0.5 font-mono text-xs",
      hot ? "bg-accent-warm/20 text-accent-warm" : "bg-muted/60 text-muted-foreground"
    )}
  >
    {children}
  </span>
);

export function dueInfo(due?: string) {
  if (!due) return null;
  const today = new Date();

  today.setHours(0, 0, 0, 0);
  const days = Math.round((+new Date(`${due}T00:00:00`) - +today) / 864e5);
  const text =
    days === 0 ? "today" : days === 1 ? "tomorrow" : days < 0 ? `${-days}d late` : `in ${days}d`;

  return { text, late: days < 0 };
}

export const minutes = (m?: number) =>
  m ? (m >= 60 ? `${+(m / 60).toFixed(1)}h` : `${m}m`) : null;

const BUTTON_FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

export const Button = ({
  onClick,
  tone = "ghost",
  children,
}: {
  onClick: () => void;
  tone?: "action" | "ghost";
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "min-h-11 rounded-lg px-inset-md py-1.5 text-xs font-medium",
      tone === "action"
        ? "bg-accent-warm text-accent-foreground"
        : "border border-border/60 text-muted-foreground",
      BUTTON_FOCUS
    )}
  >
    {children}
  </button>
);
