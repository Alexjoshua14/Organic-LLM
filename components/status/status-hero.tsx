"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";

import type { HealthReport, HealthStatus } from "@/lib/health/client-types";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function failingNames(report: HealthReport): string[] {
  return report.checks
    .filter((c) => c.status === "down" || c.status === "degraded")
    .map((c) => c.displayName);
}

function formatNames(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

function heroCopy(overall: HealthStatus, report: HealthReport): string {
  switch (overall) {
    case "ok":
      return "All systems operational";
    case "down":
      return `Down — ${formatNames(failingNames(report))}`;
    case "degraded":
      return `Degraded — ${formatNames(failingNames(report))}`;
    case "skipped":
      return "No checks configured";
    default:
      return "Checking services…";
  }
}

const ICON: Record<HealthStatus, typeof CheckCircle2> = {
  ok: CheckCircle2,
  degraded: AlertTriangle,
  down: XCircle,
  skipped: CircleDashed,
};

const ICON_CLASS: Record<HealthStatus, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  degraded: "text-amber-600 dark:text-amber-400",
  down: "text-destructive",
  skipped: "text-muted-foreground",
};

export function StatusHero({
  report,
  loading,
  className,
}: {
  report: HealthReport | null;
  loading?: boolean;
  className?: string;
}) {
  const overall = loading ? ("ok" as HealthStatus) : (report?.overall ?? "ok");
  const Icon = loading ? CircleDashed : ICON[overall];
  const text = loading ? "Checking services…" : report ? heroCopy(overall, report) : "Checking services…";

  return (
    <div
      aria-live="polite"
      className={cn(
        glass({ opaque: true }),
        "flex select-none items-center gap-2 rounded-xl border border-border/70 px-3 py-2.5 md:gap-3 md:rounded-2xl md:px-5 md:py-4",
        className
      )}
      role="status"
    >
      <Icon
        aria-hidden
        className={cn(
          "size-5 shrink-0 md:size-6",
          loading && "animate-spin text-muted-foreground",
          !loading && ICON_CLASS[overall]
        )}
      />
      <p className="text-sm font-medium leading-snug text-foreground">{text}</p>
    </div>
  );
}
