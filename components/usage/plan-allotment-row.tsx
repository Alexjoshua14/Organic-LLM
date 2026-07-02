"use client";

import type { UsageApiPayload } from "@/lib/usage/types";

import { formatPlanTooltip } from "@/lib/usage/plans";
import { formatPercent } from "@/lib/usage/format";
import { UsageSectionHeader } from "./usage-section-header";
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
    <section className="space-y-2">
      <UsageSectionHeader
        caption={`Billing cycle so far · ${billingCycleLabel}`}
        title="Plan allotment"
      />

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {planAllotments.map(({ plan, percentUsed }) => (
          <div
            key={plan.id}
            className="rounded-lg border border-border/50 bg-muted/15 px-2 py-2 text-center"
          >
            <div className="relative mb-1 flex items-center justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="font-commissioner text-2xs font-light tracking-wide text-foreground underline decoration-dotted decoration-border/60 underline-offset-2"
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
                "text-base font-semibold tabular-nums sm:text-lg",
                percentUsed >= 100 ? "text-amber-500" : "text-lumen"
              )}
            >
              {formatPercent(percentUsed)}
            </p>

            <div className="mx-auto mt-1.5 h-1 w-full max-w-[3.5rem] overflow-hidden rounded-full bg-border/40">
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
