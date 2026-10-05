"use client";

import type { UsageRangePreset } from "@/lib/usage/aggregate";
import type { UsageApiPayload } from "@/lib/usage/types";

import { PlanAllotmentRow } from "@/components/usage/plan-allotment-row";
import { UsageChart } from "@/components/usage/usage-chart";
import { UsageModelBreakdown } from "@/components/usage/usage-model-breakdown";
import { glass } from "@/components/design-system/primitives";
import { SHOWCASE_BILLING_CYCLE_LABEL } from "@/lib/showcase/models-and-usage/payloads";
import { formatTokenCount, formatUsd } from "@/lib/usage/format";
import { cn } from "@/lib/utils";

/**
 * Presentational usage panel. `UsageOverlay` is not mounted: it calls `useAuth` and
 * `fetch("/api/usage")`, which fails signed-out and would hit the network. The stat
 * cards and the 7d / 30d / 90d control follow that overlay's layout, fed by the
 * bundled payload for the selected period.
 */

const RANGE_OPTIONS: Array<{ id: UsageRangePreset; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

type UsageShowcasePanelProps = {
  payload: UsageApiPayload;
  period: UsageRangePreset;
  onPeriodChange: (period: UsageRangePreset) => void;
};

export function UsageShowcasePanel({ payload, period, onPeriodChange }: UsageShowcasePanelProps) {
  return (
    <section
      aria-label="Usage"
      className={cn("min-w-0 max-w-full rounded-2xl p-4 shadow-sm sm:p-5", glass({ opaque: true }))}
      data-period={period}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="font-commissioner text-xl font-light tracking-wide text-foreground sm:text-2xl">
            Usage
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Estimated tokens and list-rate cost for this fictional planning stretch — research, the
            shoot plan, and a voice question.
          </p>
        </div>

        <div
          aria-label="Usage period"
          className="flex w-fit shrink-0 items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-0.5"
          role="group"
        >
          {RANGE_OPTIONS.map((option) => {
            const selected = period === option.id;

            return (
              <button
                key={option.id}
                aria-pressed={selected}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                type="button"
                onClick={() => onPeriodChange(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 min-w-0 space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total tokens" value={formatTokenCount(payload.totals.totalTokens)} />
          <StatCard accent label="Est. cost" value={formatUsd(payload.totals.costUsd)} />
          <StatCard subtle label="Input" value={formatTokenCount(payload.totals.inputTokens)} />
          <StatCard subtle label="Output" value={formatTokenCount(payload.totals.outputTokens)} />
        </div>

        <div className="min-w-0 overflow-hidden">
          <UsageChart daily={payload.daily} />
        </div>

        <PlanAllotmentRow
          billingCycleLabel={SHOWCASE_BILLING_CYCLE_LABEL}
          planAllotments={payload.planAllotments}
        />

        <div className="min-w-0">
          <UsageModelBreakdown byModel={payload.byModel} pricingAsOf={payload.pricingAsOf} />
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Billing cycle totals: {formatTokenCount(payload.billingCycleTotals.totalTokens)} tokens ·{" "}
          {formatUsd(payload.billingCycleTotals.costUsd)} est. cost ·{" "}
          {payload.billingCycleTotals.callCount.toLocaleString()} calls. Plan allotment follows that
          cycle. The chart is the active days inside the selected range.
        </p>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  accent,
  subtle,
}: {
  label: string;
  value: string;
  accent?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
      <p className="text-2xs uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums sm:text-xl",
          accent && "text-lumen",
          subtle && "text-muted-foreground",
          !accent && !subtle && "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
