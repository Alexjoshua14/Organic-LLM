"use client";

import type { UsageRangePreset } from "@/lib/usage/aggregate";
import type { UsageApiPayload } from "@/lib/usage/types";

import { BarChart3, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { PlanAllotmentRow } from "./plan-allotment-row";
import { UsageChart } from "./usage-chart";
import { UsageModelBreakdown } from "./usage-model-breakdown";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/third-party/ui/dialog";
import { formatTokenCount, formatUsd } from "@/lib/usage/format";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: Array<{ id: UsageRangePreset; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

type UsageOverlayProps = {
  className?: string;
  triggerClassName?: string;
};

function formatBillingCycleLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function UsageOverlay({ className, triggerClassName }: UsageOverlayProps) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<UsageRangePreset>("30d");
  const [data, setData] = useState<UsageApiPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async (preset: UsageRangePreset) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/usage?range=${preset}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(response.status === 401 ? "Sign in to view usage" : "Could not load usage");
      }

      const payload = (await response.json()) as UsageApiPayload;

      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load usage");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !isSignedIn) return;

    void loadUsage(range);
  }, [open, isSignedIn, range, loadUsage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          aria-label="Usage and cost"
          className={cn("size-8 shrink-0", triggerClassName, className)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <BarChart3 className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[min(92dvh,780px)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-2xl"
        overlayClassName="bg-black/30 dark:bg-black/80"
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden sm:rounded-lg",
            glass({ opaque: true }),
            "backdrop-brightness-[1.18] backdrop-saturate-[1.05]",
            "dark:backdrop-brightness-100 dark:backdrop-saturate-[1.12]",
            "shadow-[0_24px_80px_-24px_rgb(0_0_0/0.18)] dark:shadow-[0_24px_80px_-24px_rgb(0_0_0/0.45)]",
            "ring-1 ring-inset ring-white/50 dark:ring-white/10"
          )}
        >
        <DialogHeader className="shrink-0 space-y-3 border-b border-border/40 px-4 py-4 text-left sm:px-6 sm:py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Organic LLM
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="font-commissioner text-xl font-light tracking-wide sm:text-2xl">
                Usage
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Tokens and estimated API cost from your LLM calls.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-0.5">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    range === option.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  type="button"
                  onClick={() => setRange(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-manipulation [scrollbar-gutter:stable]">
          <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
            {!isSignedIn ? (
              <p className="rounded-xl border border-dashed border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
                Sign in to track usage across chat and tools.
              </p>
            ) : loading && !data ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading usage…
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button size="sm" variant="secondary" onClick={() => void loadUsage(range)}>
                  Retry
                </Button>
              </div>
            ) : data ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Total tokens" value={formatTokenCount(data.totals.totalTokens)} />
                  <StatCard label="Est. cost" value={formatUsd(data.totals.costUsd)} accent />
                  <StatCard
                    label="Input"
                    value={formatTokenCount(data.totals.inputTokens)}
                    subtle
                  />
                  <StatCard
                    label="Output"
                    value={formatTokenCount(data.totals.outputTokens)}
                    subtle
                  />
                </div>

                <UsageChart daily={data.daily} />

                <PlanAllotmentRow
                  billingCycleLabel={`${formatBillingCycleLabel(data.billingCycle.start)} – today`}
                  planAllotments={data.planAllotments}
                />

                <UsageModelBreakdown byModel={data.byModel} pricingAsOf={data.pricingAsOf} />

                <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                  Billing cycle totals: {formatTokenCount(data.billingCycleTotals.totalTokens)} tokens
                  · {formatUsd(data.billingCycleTotals.costUsd)} est. cost ·{" "}
                  {data.billingCycleTotals.callCount.toLocaleString()} calls
                </p>
              </>
            ) : null}
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
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
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums sm:text-xl",
          accent ? "text-lumen" : subtle ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}
