"use client";

import type { SpeakBudgetSnapshot } from "@/lib/speak/types";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export function SpeakBudgetChip({ budget }: { budget: SpeakBudgetSnapshot | null }) {
  if (!budget) {
    return (
      <div
        className={cn(
          glass({ border: "all" }),
          "rounded-2xl px-3 py-1.5 text-[11px] text-muted-foreground"
        )}
      >
        Budget: awaiting session
      </div>
    );
  }

  const costPct =
    budget.monthlyCostCapUsd > 0
      ? (budget.monthlyCostUsedUsd / budget.monthlyCostCapUsd) * 100
      : 0;
  const warn = costPct >= 80 || budget.dailyMinutesRemaining <= 5;

  return (
    <div
      className={cn(
        glass({ border: "all" }),
        "rounded-2xl px-3 py-1.5 text-[11px] tabular-nums",
        warn ? "text-amber-200" : "text-muted-foreground"
      )}
      title="Speak Realtime spend & minute caps"
    >
      ${budget.monthlyCostRemainingUsd.toFixed(2)} left · {budget.dailyMinutesRemaining}m today ·
      max {budget.sessionMaxMinutes}m/session
    </div>
  );
}
