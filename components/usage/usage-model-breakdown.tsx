"use client";

import type { UsageApiPayload } from "@/lib/usage/types";

import {
  formatCachedInputRate,
  formatCachedTokenCount,
  formatModelRate,
  formatTokenCount,
  formatUsd,
  shortModelLabel,
} from "@/lib/usage/format";
import { formatDate } from "@/lib/format/stringFormatting";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/third-party/ui/tooltip";
import { UsageSectionHeader } from "./usage-section-header";
import {
  usageRowMetric,
  usageRowModel,
  usageRowPrimary,
} from "./usage-typography";
import { cn } from "@/lib/utils";

type UsageModelBreakdownProps = {
  byModel: UsageApiPayload["byModel"];
  pricingAsOf: string;
};

const GRID_WITH_CACHED =
  "sm:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]";
const GRID_WITHOUT_CACHED =
  "sm:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]";

function formatPricingAsOfDate(dateString: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? `${dateString}T12:00:00` : dateString;

  return formatDate(iso);
}

export function UsageModelBreakdown({ byModel, pricingAsOf }: UsageModelBreakdownProps) {
  if (byModel.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
        Model breakdown appears after your first tracked LLM calls.
      </section>
    );
  }

  const showCachedColumn = byModel.some(
    (row) => row.cachedInputPerMillion !== undefined || row.cachedInputTokens > 0
  );
  const gridClass = showCachedColumn ? GRID_WITH_CACHED : GRID_WITHOUT_CACHED;

  return (
    <section className="space-y-2">
      <UsageSectionHeader
        caption={`List pricing as of ${formatPricingAsOfDate(pricingAsOf)}`}
        title="By model"
      />

      <div className="overflow-hidden rounded-xl border border-border/50">
        <div
          className={cn(
            "hidden gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:grid",
            gridClass
          )}
        >
          <span>Model</span>
          <span className="text-right">Input</span>
          {showCachedColumn ? <span className="text-right">Cached</span> : null}
          <span className="text-right">Output</span>
          <span className="text-right">Cost</span>
          <span className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="uppercase underline decoration-dotted decoration-border/60 underline-offset-2"
                  type="button"
                >
                  Rate
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[12rem] space-y-1 text-xs" side="top">
                <p>Per 1M input / output tokens</p>
                {showCachedColumn ? <p>Per 1M cached input tokens</p> : null}
              </TooltipContent>
            </Tooltip>
          </span>
        </div>

        <ul className="divide-y divide-border/30">
          {byModel.map((row) => (
            <li
              key={row.modelId}
              className={cn("grid gap-1 px-3 py-2 sm:items-center sm:gap-2", gridClass)}
            >
              <div className="min-w-0">
                <p className={usageRowModel}>{shortModelLabel(row.modelId)}</p>
                <p className={cn(usageRowMetric, "sm:hidden")}>
                  {formatModelRate(row.inputPerMillion, row.outputPerMillion)}
                  {row.cachedInputPerMillion !== undefined ? (
                    <>
                      {" · "}
                      {formatCachedInputRate(row.cachedInputPerMillion)} cached
                    </>
                  ) : null}
                </p>
              </div>
              <p className={cn(usageRowMetric, "text-right")}>
                <span className="sm:hidden text-[9px] uppercase tracking-wide">In </span>
                {formatTokenCount(row.inputTokens)}
              </p>
              {showCachedColumn ? (
                <p className={cn(usageRowMetric, "text-right")}>
                  <span className="sm:hidden text-[9px] uppercase tracking-wide">Cached </span>
                  {formatCachedTokenCount(row.cachedInputTokens)}
                </p>
              ) : null}
              <p className={cn(usageRowMetric, "text-right")}>
                <span className="sm:hidden text-[9px] uppercase tracking-wide">Out </span>
                {formatTokenCount(row.outputTokens)}
              </p>
              <p className={cn(usageRowPrimary, "text-right")}>{formatUsd(row.costUsd)}</p>
              <p className={cn(usageRowMetric, "hidden text-right sm:block")}>
                {formatModelRate(row.inputPerMillion, row.outputPerMillion)}
                {row.cachedInputPerMillion !== undefined ? (
                  <>
                    {" · "}
                    {formatCachedInputRate(row.cachedInputPerMillion)} cached
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
