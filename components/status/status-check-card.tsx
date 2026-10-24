"use client";

import type { HealthCheckResult } from "@/lib/health/client-types";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { StatusCheckDetails } from "./status-check-details";
import { StatusPill } from "./status-pill";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function rowAccent(status: HealthCheckResult["status"]): string {
  if (status === "down") return "border-l-destructive bg-destructive/5";
  if (status === "degraded") return "border-l-amber-500 bg-amber-500/5";
  if (status === "skipped") return "border-l-muted-foreground/40 bg-muted/20";

  return "border-l-transparent";
}

function shouldExpandDefault(status: HealthCheckResult["status"]): boolean {
  return status === "down" || status === "degraded";
}

export function StatusCheckCard({ check }: { check: HealthCheckResult }) {
  const [expanded, setExpanded] = useState(() => shouldExpandDefault(check.status));
  const showSummary = check.status !== "ok" && check.summary;
  const hasDetails =
    Boolean(check.message) || (check.config && Object.keys(check.config).length > 0);

  return (
    <article
      className={cn(
        glass(),
        "rounded-xl border border-border/70 border-l-[3px] px-2.5 py-2 select-none",
        rowAccent(check.status)
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-xs font-medium text-foreground">{check.displayName}</h2>
          <StatusPill serviceName={check.displayName} status={check.status} />
          {check.status === "ok" && check.latencyMs != null ? (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {check.latencyMs} ms
            </span>
          ) : null}
        </div>
        {showSummary ? (
          <p
            className={cn(
              "mt-0.5 text-xs leading-snug",
              check.status === "down" && "text-destructive",
              check.status === "degraded" && "text-amber-800 dark:text-amber-200",
              check.status === "skipped" && "text-muted-foreground"
            )}
          >
            <span className="select-text">{check.summary}</span>
          </p>
        ) : null}
      </div>

      {hasDetails ? (
        <div className="mt-1">
          <button
            aria-expanded={expanded}
            className="flex h-7 items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground -ml-0.5"
            type="button"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
            Details
          </button>
          {expanded ? <StatusCheckDetails check={check} className="mt-1" /> : null}
        </div>
      ) : null}
    </article>
  );
}

export function StatusCheckCardList({ checks }: { checks: HealthCheckResult[] }) {
  return (
    <ul className="flex flex-col gap-1.5 list-none p-0 m-0 md:hidden">
      {checks.map((check) => (
        <li key={check.id}>
          <StatusCheckCard check={check} />
        </li>
      ))}
    </ul>
  );
}
