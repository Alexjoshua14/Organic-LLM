"use client";

import type { UsageApiPayload } from "@/lib/usage/types";

import { formatPlanTooltip } from "@/lib/usage/plans";
import { formatPercent } from "@/lib/usage/format";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/third-party/ui/tooltip";

type PlanAllotmentRowProps = {
  planAllotments: UsageApiPayload["planAllotments"];
  billingCycleLabel: string;
};

export function PlanAllotmentRow({ planAllotments, billingCycleLabel }: PlanAllotmentRowProps) {
  return (
    <section className="space-y-3 border-t border-border/40 pt-4">
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
          Plan allotment
        </p>
        <p className="text-[11px] text-muted-foreground">
          Billing cycle so far · {billingCycleLabel}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {planAllotments.map(({ plan, percentUsed }) => (
          <div
            key={plan.id}
            className="rounded-xl border border-border/50 bg-muted/15 px-2.5 py-3 text-center sm:px-3"
          >
            <div className="relative mb-2 flex items-center justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="font-commissioner text-xs font-light tracking-wide text-foreground underline decoration-dotted decoration-border/60 underline-offset-2"
                    type="button"
                  >
                    {plan.name}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[14rem] text-xs" side="top">
                  {formatPlanTooltip(plan)}
                </TooltipContent>
              </Tooltip>
            </div>

            <p
              className={cn(
                "text-xl font-semibold tabular-nums sm:text-2xl",
                percentUsed >= 100 ? "text-amber-500" : "text-lumen"
              )}
            >
              {formatPercent(percentUsed)}
            </p>

            <div className="mx-auto mt-2 h-1.5 w-full max-w-[5rem] overflow-hidden rounded-full bg-border/40">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  percentUsed >= 100 ? "bg-amber-500/90" : "bg-lumen/80"
                )}
                style={{ width: `${Math.min(100, percentUsed)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
