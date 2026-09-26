"use client";

import type { PlanPublicTier } from "@/lib/plans/plan-capacity";

import { PageTopBar } from "@/components/layout/page-top-bar";
import { ReturnButton } from "@/components/ReturnButton";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function formatTokenCap(tokenCap: number | null): string {
  if (tokenCap == null) return "No fixed token allotment";
  if (tokenCap >= 1_000_000) return `${(tokenCap / 1_000_000).toFixed(0)}M tokens / month`;

  return `${Math.round(tokenCap / 1_000)}K tokens / month`;
}

function formatBudget(monthlyBudgetUsd: number | null): string {
  if (monthlyBudgetUsd == null) return "No monthly dollar ceiling";

  return `$${monthlyBudgetUsd.toFixed(0)} API spend / UTC calendar month`;
}

function capacityLine(tier: PlanPublicTier): string[] {
  const lines: string[] = [];

  if (tier.rabbitHoles != null) {
    lines.push(`Generate up to ${tier.rabbitHoles.toLocaleString()} rabbit holes`);
  } else {
    lines.push("Rabbit hole capacity follows your uncapped spend budget");
  }

  if (tier.voiceHours != null) {
    lines.push(`Use up to ${tier.voiceHours} hours of realtime voice a month`);
  } else {
    lines.push("Realtime voice follows your uncapped spend budget");
  }

  lines.push(`Max of ${tier.simultaneousStreams} simultaneous LLM streams`);

  return lines;
}

function TierCard({ tier }: { tier: PlanPublicTier }) {
  const isMax = tier.id === "max";
  const lines = capacityLine(tier);

  return (
    <article
      className={cn(
        glass({ opaque: true }),
        "flex min-w-0 flex-col rounded-2xl p-5 md:p-6",
        isMax && "ring-1 ring-accent/35"
      )}
    >
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {isMax ? "Allowlisted" : "Default"}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {tier.name}
        </h2>
        <p className="text-sm text-muted-foreground">{tier.priceLabel}</p>
      </header>

      <ul className="mt-5 space-y-2.5 text-sm leading-snug text-foreground/90">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent/80" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3 border-t border-border/50 pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Meter
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <dt className="text-muted-foreground">Monthly budget</dt>
            <dd className="text-foreground sm:text-right">{formatBudget(tier.monthlyBudgetUsd)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <dt className="text-muted-foreground">Token allotment</dt>
            <dd className="text-foreground sm:text-right">{formatTokenCap(tier.tokenCap)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <dt className="text-muted-foreground">Rate limit</dt>
            <dd className="text-foreground sm:text-right">
              {tier.llmRequestsPerMinute} LLM requests / minute
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <dt className="text-muted-foreground">Streams</dt>
            <dd className="text-foreground sm:text-right">
              {tier.simultaneousStreams} simultaneous
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export function PlansPageClient({ tiers }: { tiers: PlanPublicTier[] }) {
  return (
    <div className="relative z-10 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <PageTopBar leading={<ReturnButton />} title="Plans" withBorder />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] md:px-8 md:py-10">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Organic LLM
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground md:text-base">
              Two tiers. Free includes a monthly spend budget measured from real model usage. Max
              removes the dollar ceiling while keeping the same stream and request guards that keep
              the service steady.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            {tiers.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Capacity figures for chats, rabbit holes, and voice are derived from the monthly spend
            budget at published model rates. Actual use varies with model choice and session length.
            Max does not promise unlimited rabbit holes or voice — only that there is no fixed
            monthly dollar cap.
          </p>
        </div>
      </div>
    </div>
  );
}
