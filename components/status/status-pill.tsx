"use client";

import type { HealthStatus } from "@/lib/health/client-types";
import { cn } from "@/lib/utils";

const STYLES: Record<HealthStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
  down: "bg-destructive/15 text-destructive border-destructive/30",
  skipped: "bg-muted text-muted-foreground border-border/50",
};

const LABELS: Record<HealthStatus, string> = {
  ok: "OK",
  degraded: "Degraded",
  down: "Down",
  skipped: "Skipped",
};

export function StatusPill({
  status,
  serviceName,
  className,
}: {
  status: HealthStatus;
  serviceName?: string;
  className?: string;
}) {
  const label = LABELS[status];
  return (
    <span
      aria-label={serviceName ? `${serviceName}: ${label}` : label}
      className={cn(
        "inline-flex select-none items-center rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide md:rounded-md md:px-2 md:py-0.5 md:text-[11px]",
        STYLES[status],
        className
      )}
    >
      {label}
    </span>
  );
}
