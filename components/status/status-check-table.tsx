"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";

import { StatusCheckDetails } from "./status-check-details";
import { StatusPill } from "./status-pill";

import type { HealthCheckResult } from "@/lib/health/client-types";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function rowAccent(status: HealthCheckResult["status"]): string {
  if (status === "down") return "border-l-destructive";
  if (status === "degraded") return "border-l-amber-500";
  if (status === "skipped") return "border-l-muted-foreground/50";
  return "border-l-transparent";
}

function latencyLabel(check: HealthCheckResult): string | null {
  if (check.status === "ok" && check.latencyMs != null) {
    return `${check.latencyMs} ms`;
  }
  return null;
}

function issueCell(check: HealthCheckResult): string {
  if (check.status === "ok") return "—";
  return check.summary;
}

export function StatusCheckTable({ checks }: { checks: HealthCheckResult[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const first = checks.find((c) => c.status === "down" || c.status === "degraded");
    return first?.id ?? null;
  });

  return (
    <div className="hidden md:block overflow-x-auto">
      <table
        className={cn(
          glass(),
          "w-full min-w-[480px] select-none text-xs rounded-xl border border-border/70 overflow-hidden md:min-w-[560px] md:rounded-2xl md:text-sm"
        )}
      >
        <caption className="sr-only">Service health checks</caption>
        <thead className="select-none">
          <tr className="border-b border-border/60 text-left">
            <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:px-5 md:py-3.5 md:text-xs">
              Service
            </th>
            <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:px-5 md:py-3.5 md:text-xs">
              Status
            </th>
            <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:px-5 md:py-3.5 md:text-xs">
              Issue
            </th>
            <th className="w-8 px-2 py-2 md:w-11 md:px-4 md:py-3.5">
              <span className="sr-only">Expand</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => {
            const expanded = expandedId === check.id;
            const hasDetails =
              Boolean(check.message) ||
              (check.config && Object.keys(check.config).length > 0);

            return (
              <Fragment key={check.id}>
                <tr
                  className={cn(
                    "border-b border-border/40 border-l-[3px]",
                    rowAccent(check.status),
                    hasDetails && "cursor-pointer hover:bg-muted/30"
                  )}
                  onClick={() => {
                    if (!hasDetails) return;
                    setExpandedId((id) => (id === check.id ? null : check.id));
                  }}
                >
                  <td className="px-3 py-2 font-medium text-foreground md:px-5 md:py-4 md:text-[15px]">
                    {check.displayName}
                  </td>
                  <td className="px-3 py-2 md:px-5 md:py-4">
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2.5">
                      <StatusPill serviceName={check.displayName} status={check.status} />
                      {latencyLabel(check) ? (
                        <span className="text-[11px] tabular-nums text-muted-foreground md:text-xs">
                          {latencyLabel(check)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 max-w-md md:max-w-lg md:px-5 md:py-4 md:leading-relaxed",
                      check.status === "ok" && "text-muted-foreground",
                      check.status === "down" && "text-destructive",
                      check.status === "degraded" && "text-amber-800 dark:text-amber-200"
                    )}
                  >
                    {check.status === "ok" ? (
                      issueCell(check)
                    ) : (
                      <span className="select-text">{issueCell(check)}</span>
                    )}
                  </td>
                  <td className="w-8 px-2 py-2 text-right align-middle md:w-11 md:px-4 md:py-4">
                    {hasDetails ? (
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "ml-auto size-3 shrink-0 text-muted-foreground transition-transform md:size-4",
                          expanded && "rotate-180"
                        )}
                      />
                    ) : null}
                  </td>
                </tr>
                {expanded && hasDetails ? (
                  <tr className="border-b border-border/40 bg-muted/20">
                    <td className="px-3 py-2 md:px-5 md:py-4" colSpan={4}>
                      <StatusCheckDetails check={check} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
