"use client";

import type { HealthCheckResult } from "@/lib/health/client-types";

import { cn } from "@/lib/utils";

export function StatusCheckDetails({
  check,
  className,
}: {
  check: HealthCheckResult;
  className?: string;
}) {
  const entries = check.config ? Object.entries(check.config) : [];

  if (entries.length === 0 && !check.message) return null;

  return (
    <div
      className={cn(
        "select-none rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 text-[11px] md:rounded-lg md:px-4 md:py-3 md:text-xs",
        className
      )}
    >
      {entries.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono md:gap-x-4 md:gap-y-1.5">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="min-w-0 break-all text-foreground">
                <span className="select-text">{value}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {check.message ? (
        <p
          className={cn(
            "text-muted-foreground leading-snug",
            entries.length > 0 && "mt-1 border-t border-border/40 pt-1"
          )}
        >
          <span className="select-text">{check.message}</span>
        </p>
      ) : null}
    </div>
  );
}
