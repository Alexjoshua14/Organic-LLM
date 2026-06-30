"use client";

import type { UsageApiPayload } from "@/lib/usage/types";

import {
  formatModelRate,
  formatTokenCount,
  formatUsd,
  shortModelLabel,
} from "@/lib/usage/format";

type UsageModelBreakdownProps = {
  byModel: UsageApiPayload["byModel"];
  pricingAsOf: string;
};

export function UsageModelBreakdown({ byModel, pricingAsOf }: UsageModelBreakdownProps) {
  if (byModel.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
        Model breakdown appears after your first tracked LLM calls.
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            By model
          </p>
          <p className="text-[11px] text-muted-foreground">List pricing as of {pricingAsOf}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="hidden grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:grid">
          <span>Model</span>
          <span className="text-right">Input</span>
          <span className="text-right">Output</span>
          <span className="text-right">Cost</span>
          <span className="text-right">Rate</span>
        </div>

        <ul className="divide-y divide-border/30">
          {byModel.map((row) => (
            <li
              key={row.modelId}
              className="grid gap-1 px-3 py-2.5 sm:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] sm:items-center sm:gap-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{shortModelLabel(row.modelId)}</p>
                <p className="text-[10px] text-muted-foreground sm:hidden">
                  {formatModelRate(row.inputPerMillion, row.outputPerMillion)}
                </p>
              </div>
              <p className="text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
                <span className="sm:hidden text-[10px] uppercase tracking-wide">In </span>
                {formatTokenCount(row.inputTokens)}
              </p>
              <p className="text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
                <span className="sm:hidden text-[10px] uppercase tracking-wide">Out </span>
                {formatTokenCount(row.outputTokens)}
              </p>
              <p className="text-right text-sm font-medium tabular-nums text-foreground">
                {formatUsd(row.costUsd)}
              </p>
              <p className="hidden text-right text-[10px] leading-snug text-muted-foreground sm:block">
                {formatModelRate(row.inputPerMillion, row.outputPerMillion)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
