"use client";

import type { PlanBudgetSnapshot } from "@/lib/plans/plan-tags";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/third-party/ui/button";
import { formatResetCountdown } from "@/lib/plans/budget-cycle";
import { getUsagePlanTier } from "@/lib/usage/plans";
import { formatUsd } from "@/lib/usage/format";
import { cn } from "@/lib/utils";

/** How often the reset countdown re-renders. Minutes are its finest unit, so 30s is plenty. */
const RESET_COUNTDOWN_TICK_MS = 30_000;

type PlanStatusCardProps = {
  plan: PlanBudgetSnapshot;
  /** Spend one reset. Resolves to an error message, or null on success. */
  onReset: (resetVersion: string) => Promise<string | null>;
};

/**
 * The user's plan this week: spend against the cap, when the window resets, and resets left —
 * with a confirm step before spending one, since a reset cannot be undone.
 */
export function PlanStatusCard({ plan, onReset }: PlanStatusCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const resetPending = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), RESET_COUNTDOWN_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const tier = getUsagePlanTier(plan.plan);
  const resetsIn = formatResetCountdown(Date.parse(plan.cycleEnd) - now);
  const percent = plan.capUsd ? Math.min(100, (plan.usedUsd / plan.capUsd) * 100) : 0;
  const unavailable = plan.status === "unavailable";
  const reached = !unavailable && !plan.canDispatch;
  const resets = plan.resetsRemaining;

  const confirmReset = async () => {
    if (resetPending.current || !plan.resetVersion) return;
    resetPending.current = true;
    setResetting(true);
    setResetError(null);
    try {
      setResetError(await onReset(plan.resetVersion));
    } catch {
      setResetError("Could not start a fresh window. Refresh Usage before trying again.");
    } finally {
      resetPending.current = false;
      setResetting(false);
      setConfirming(false);
    }
  };

  return (
    <section
      aria-label="Plan status"
      className={cn(
        "space-y-2.5 rounded-xl border px-3 py-3",
        reached ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-muted/15"
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">
          {tier.name} plan
          {plan.source === "override" ? (
            <span className="ml-1.5 text-2xs text-muted-foreground">(override)</span>
          ) : null}
        </p>
        {!unavailable ? (
          <p
            className="text-xs tabular-nums text-muted-foreground"
            title={new Date(plan.cycleEnd).toLocaleString()}
          >
            Resets in {resetsIn}
          </p>
        ) : null}
      </div>

      {unavailable ? (
        <p className="text-xs text-muted-foreground">
          Usage check unavailable. New requests are paused until it recovers.
        </p>
      ) : plan.capUsd !== null ? (
        <div className="space-y-1.5">
          <p className="text-xs tabular-nums text-muted-foreground">
            <span className="text-foreground">{formatUsd(plan.usedUsd)}</span> of{" "}
            {formatUsd(plan.capUsd)} this week
          </p>
          <div
            role="progressbar"
            aria-label="Weekly plan allowance"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            className="h-1 overflow-hidden rounded-full bg-border/40"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                reached ? "bg-amber-500/90" : "bg-lumen/80"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No weekly spend cap.</p>
      )}

      {!unavailable && plan.holdReason ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {plan.holdReason} New requests are paused until the window resets.
        </p>
      ) : null}

      {resets !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <p className="text-xs text-muted-foreground">
            {resets} reset{resets === 1 ? "" : "s"} left
          </p>
          {confirming ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Use 1 of {resets}?</span>
              <Button
                disabled={resetting}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void confirmReset()}
              >
                {resetting ? "Starting…" : "Start fresh window"}
              </Button>
              <Button
                disabled={resetting}
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              disabled={resets === 0}
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setConfirming(true)}
            >
              Start a fresh window
            </Button>
          )}
        </div>
      ) : null}
      {resetError ? <p className="text-xs text-destructive">{resetError}</p> : null}
    </section>
  );
}
