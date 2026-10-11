"use client";

import type { BudgetCycleRange } from "@/lib/plans/budget-cycle";
import type { UsageApiPayload } from "@/lib/usage/types";

import { BarChart3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import { PlanAllotmentRow } from "./plan-allotment-row";
import { PlanStatusCard } from "./plan-status-card";
import { UsageChart } from "./usage-chart";
import { UsageModelBreakdown } from "./usage-model-breakdown";
import { UsagePanelSkeleton, UsageTrackingNote } from "./usage-panel-skeleton";
import { USAGE_REFRESH_MS, UsageRefreshProgress } from "./usage-refresh-progress";
import { UsageStatCard } from "./usage-stat-card";

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

/** Short labels so the four budget-cycle ranges fit the header on a phone. */
const RANGE_OPTIONS: Array<{ id: BudgetCycleRange; label: string }> = [
  { id: "current", label: "This cycle" },
  { id: "previous", label: "Previous" },
  { id: "last3", label: "Last 3" },
  { id: "last6", label: "Last 6" },
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
  const [range, setRange] = useState<BudgetCycleRange>("current");
  const [data, setData] = useState<UsageApiPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshAt, setRefreshAt] = useState<number | null>(null);

  const requestRef = useRef(0);
  const loadingRef = useRef(false);

  const loadUsage = useCallback(async (preset: BudgetCycleRange) => {
    const request = ++requestRef.current;

    loadingRef.current = true;
    setLoading(true);
    setRefreshAt(null);
    setError(null);

    try {
      const response = await fetch(`/api/usage?range=${preset}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(response.status === 401 ? "Sign in to view usage" : "Could not load usage");
      }

      const payload = (await response.json()) as UsageApiPayload;

      if (request === requestRef.current) setData(payload);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err.message : "Could not load usage");
    } finally {
      if (request === requestRef.current) {
        loadingRef.current = false;
        setLoading(false);
        setRefreshAt(Date.now() + USAGE_REFRESH_MS);
      }
    }
  }, []);

  const spendReset = useCallback(async (resetVersion: string): Promise<string | null> => {
    try {
      const response = await fetch("/api/usage/reset", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetVersion }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;

        return body?.error ?? "Could not start a fresh window";
      }
      const result = await response.json() as Pick<UsageApiPayload, "plan">;

      setData((previous) => previous ? { ...previous, plan: result.plan } : previous);
      await loadUsage(range);

      return null;
    } catch {
      return "Could not start a fresh window";
    }
  }, [loadUsage, range]);

  useEffect(() => {
    if (!open || !isSignedIn) return;

    void loadUsage(range);
    const refresh = () => {
      if (document.visibilityState === "visible" && !loadingRef.current) void loadUsage(range);
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      requestRef.current += 1;
      loadingRef.current = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [open, isSignedIn, range, loadUsage]);

  useEffect(() => {
    if (!open || !isSignedIn || refreshAt === null) return;

    const timer = window.setTimeout(
      () => {
        if (document.visibilityState === "visible") void loadUsage(range);
      },
      Math.max(0, refreshAt - Date.now())
    );

    return () => window.clearTimeout(timer);
  }, [open, isSignedIn, range, refreshAt, loadUsage]);

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
        className="flex h-[min(92dvh,780px)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-2xl"
        overlayClassName="bg-black/30 dark:bg-black/80"
      >
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-hidden sm:rounded-lg",
            glass({ opaque: true }),
            "backdrop-brightness-[1.18] backdrop-saturate-[1.05]",
            "dark:backdrop-brightness-100 dark:backdrop-saturate-[1.12]",
            "shadow-[0_24px_80px_-24px_rgb(0_0_0/0.18)] dark:shadow-[0_24px_80px_-24px_rgb(0_0_0/0.45)]",
            "ring-1 ring-inset ring-white/50 dark:ring-white/10"
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border/40 px-4 py-4 text-left sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="space-y-3">
                <DialogTitle className="text-[11px] font-normal uppercase leading-normal tracking-[0.18em] text-muted-foreground/70">
                  Organic • Usage
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Tracked LLM calls. Usage refreshes automatically while this panel is open.
                </DialogDescription>
                <UsageRefreshProgress
                  key={refreshAt ?? "refreshing"}
                  loading={open && !!isSignedIn && loading}
                  refreshAt={open && isSignedIn ? refreshAt : null}
                />
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

          <div
            aria-busy={isSignedIn !== false && (loading || (!data && !error))}
            aria-label="Usage data"
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-manipulation [scrollbar-gutter:stable]"
            role="region"
          >
            <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
              {isSignedIn === false ? (
                <p className="rounded-xl border border-dashed border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
                  Sign in to track usage across chat and tools.
                </p>
              ) : !data && (loading || !error) ? (
                <UsagePanelSkeleton />
              ) : error && !data ? (
                <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button size="sm" variant="secondary" onClick={() => void loadUsage(range)}>
                    Retry
                  </Button>
                </div>
              ) : data ? (
                <>
                  <PlanStatusCard plan={data.plan} onReset={spendReset} />

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <UsageStatCard
                      label="Total tokens"
                      value={formatTokenCount(data.totals.totalTokens)}
                    />
                    <UsageStatCard label="Tracked cost" value={formatUsd(data.totals.costUsd)} accent />
                    <UsageStatCard
                      label="Input"
                      value={formatTokenCount(data.totals.inputTokens)}
                      subtle
                    />
                    <UsageStatCard
                      label="Output"
                      value={formatTokenCount(data.totals.outputTokens)}
                      subtle
                    />
                  </div>

                  {data.gatewaySpend ? (
                    <div className="space-y-2 rounded-xl border border-border/50 px-3 py-3 text-xs">
                      <p className="font-medium">Gateway spend · admin</p>
                      {data.gatewaySpend.status === "available" ? <>
                        <p className="flex justify-between gap-3"><span>Gateway account total</span><span className="tabular-nums">{formatUsd(data.gatewaySpend.accountCostUsd)}</span></p>
                        <p className="flex justify-between gap-3"><span>Attributed to you</span><span className="tabular-nums">{formatUsd(data.gatewaySpend.attributedCostUsd)}</span></p>
                        <p className="text-muted-foreground">Account total includes other users and apps on this Gateway account. User attribution covers tagged requests; older calls may be unattributed. Direct-provider calls are separate. Reports can lag recent activity.</p>
                      </> : <p className="text-muted-foreground">Gateway reporting is unavailable. Tracked cost below is not a complete account bill.</p>}
                    </div>
                  ) : null}
                  <UsageTrackingNote />
                  <UsageChart daily={data.daily} />

                  <PlanAllotmentRow
                    billingCycleLabel={`${formatBillingCycleLabel(data.billingCycle.start)} – now`}
                    planAllotments={data.planAllotments}
                  />

                  <UsageModelBreakdown byModel={data.byModel} pricingAsOf={data.pricingAsOf} />

                  <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                    This cycle: {formatTokenCount(data.billingCycleTotals.totalTokens)}{" "}
                    tokens · {formatUsd(data.billingCycleTotals.costUsd)} est. cost ·{" "}
                    {data.billingCycleTotals.callCount.toLocaleString()} calls
                  </p>
                </>
              ) : null}
            </div>
          </div>
          {isSignedIn && data && error ? (
            <div
              className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-background/95 px-3 py-2 shadow-sm sm:inset-x-6"
              role="status"
            >
              <p className="text-xs text-muted-foreground">{error}. Showing previous data.</p>
              <Button size="sm" variant="secondary" onClick={() => void loadUsage(range)}>
                Retry refresh
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
