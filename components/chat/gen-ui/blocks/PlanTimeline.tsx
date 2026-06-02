"use client";

import type { PlanTimelineBlock, PlanTimelineStep } from "@/lib/schemas/gen-ui";
import { cn } from "@/lib/utils";

const STATUS_NODE: Record<
  PlanTimelineStep["status"],
  { symbol: string; ring: string; pulse?: boolean }
> = {
  done: { symbol: "✓", ring: "bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300" },
  now: {
    symbol: "●",
    ring: "bg-primary/20 border-primary/50 text-primary",
    pulse: true,
  },
  next: { symbol: "○", ring: "bg-muted/30 border-border text-muted-foreground" },
  blocked: { symbol: "⊘", ring: "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400" },
};

type PlanTimelineProps = {
  block: PlanTimelineBlock;
  partial?: boolean;
};

function StepRow({
  step,
  stepLabelsById,
  partial,
}: {
  step: PlanTimelineStep;
  stepLabelsById: Map<string, string>;
  partial?: boolean;
}) {
  const node = STATUS_NODE[step.status];
  const expanded = step.status === "now";

  const depLabels =
    step.dependsOn
      ?.map((id) => stepLabelsById.get(id))
      .filter((l): l is string => Boolean(l)) ?? [];

  return (
    <li
      role="listitem"
      aria-current={step.status === "now" ? "step" : undefined}
      className="relative pl-8 pb-4 last:pb-0"
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold",
          node.ring,
          node.pulse && "motion-safe:animate-pulse"
        )}
        aria-hidden
      >
        {node.symbol}
      </span>

      {expanded ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-sm text-foreground">{step.label}</span>
            {step.estimate ? (
              <span className="text-[11px] text-muted-foreground">{step.estimate}</span>
            ) : null}
          </div>
          {step.note ? <p className="text-xs text-muted-foreground">{step.note}</p> : null}
          {depLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {depLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border/50 bg-background-tertiary/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  ↑ depends on: {label}
                </span>
              ))}
            </div>
          ) : null}
          {step.substeps?.length ? (
            <ul className="space-y-1 text-xs text-foreground">
              {step.substeps.map((sub, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{sub.done ? "☑" : "☐"}</span>
                  {sub.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <details className="group">
          <summary className="cursor-pointer text-sm text-foreground list-none flex items-center gap-2">
            <span className="font-medium">{step.label}</span>
            {step.estimate ? (
              <span className="text-[11px] text-muted-foreground">{step.estimate}</span>
            ) : null}
          </summary>
          <div className="mt-2 space-y-1 pl-0">
            {step.note ? <p className="text-xs text-muted-foreground">{step.note}</p> : null}
            {depLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {depLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    ↑ {label}
                  </span>
                ))}
              </div>
            ) : null}
            {step.substeps?.map((sub, i) => (
              <p key={i} className="text-xs">
                {sub.done ? "✓" : "○"} {sub.label}
              </p>
            ))}
          </div>
        </details>
      )}

      {partial && !step.label ? (
        <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse mt-1" />
      ) : null}
    </li>
  );
}

export function PlanTimeline({ block, partial }: PlanTimelineProps) {
  const doneCount = block.steps.filter((s) => s.status === "done").length;
  const progress = block.steps.length > 0 ? doneCount / block.steps.length : 0;
  const stepLabelsById = new Map(block.steps.map((s) => [s.id, s.label]));

  return (
    <div className="space-y-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full rounded-full bg-primary/70 transition-all duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={block.steps.length}
          aria-label={`${doneCount} of ${block.steps.length} steps complete`}
        />
      </div>

      <ol role="list" className="relative border-l border-border/40 ml-3 space-y-0">
        {block.steps.map((step) => (
          <StepRow
            key={step.id}
            partial={partial}
            step={step}
            stepLabelsById={stepLabelsById}
          />
        ))}
      </ol>
    </div>
  );
}
