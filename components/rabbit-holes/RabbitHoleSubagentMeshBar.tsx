"use client";

import type {
  LlmProcessingIntensitySnapshot,
  OrganicActivityState,
} from "@/lib/usage/processing-intensity";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";

import { OrganicActivityMark } from "@/components/chat/organic-activity-mark";
import { glass } from "@/components/design-system/primitives";
import {
  computeLlmProcessingIntensity,
  formatCompactTokenCount,
} from "@/lib/usage/processing-intensity";
import { cn } from "@/lib/utils";

export type RabbitHoleSubagentStatus =
  | "idle"
  | "queued"
  | "working"
  | "blocked"
  | "done"
  | "complete";

export type RabbitHoleSubagentMeshItem = {
  id?: string;
  agentId?: string;
  threadId?: string | null;
  name: string;
  role?: string;
  status: RabbitHoleSubagentStatus;
  statusAt?: string | null;
  goal?: string | null;
  brief?: string | null;
  outcome?: string | null;
  progress?: string | null;
  response?: string | null;
  latestResponse?: string | null;
  modelId?: string | null;
  activitySeed?: string;
  identityImageUrl?: string | null;
};

export type RabbitHolePlanBudgetSummary = {
  spentUsd?: number;
  usedUsd?: number;
  limitUsd?: number | null;
  capUsd?: number | null;
  remainingUsd?: number | null;
  canDispatch?: boolean;
  plan?: string;
};

export type RabbitHoleSubagentMeshBarProps = {
  subagents?: readonly RabbitHoleSubagentMeshItem[];
  processingIntensity?: LlmProcessingIntensitySnapshot;
  planBudget?: RabbitHolePlanBudgetSummary | null;
  zeroDataRetention?: boolean;
  defaultExpanded?: boolean;
  defaultSelectedAgentId?: string | null;
  className?: string;
};

const WORKER_STATUS_LABEL: Record<RabbitHoleSubagentStatus, string> = {
  idle: "Idle",
  queued: "Queued",
  working: "Working",
  blocked: "Blocked",
  done: "Done",
  complete: "Complete",
};

function workerMarkState(status: RabbitHoleSubagentStatus): OrganicActivityState {
  switch (status) {
    case "working":
    case "queued":
      return "working";
    case "blocked":
      return "blocked";
    case "done":
    case "complete":
      return "complete";
    default:
      return "idle";
  }
}

function workerKey(worker: RabbitHoleSubagentMeshItem, index: number): string {
  return worker.agentId ?? worker.id ?? worker.threadId ?? `${worker.name}-${index}`;
}

function workerBrief(worker: RabbitHoleSubagentMeshItem): string | null {
  return worker.brief?.trim() || worker.goal?.trim() || null;
}

function workerOutput(worker: RabbitHoleSubagentMeshItem): string | null {
  return (
    worker.latestResponse?.trim() ||
    worker.response?.trim() ||
    worker.outcome?.trim() ||
    worker.progress?.trim() ||
    null
  );
}

function resolveBudgetNumbers(
  planBudget: RabbitHolePlanBudgetSummary | null | undefined,
  intensity: LlmProcessingIntensitySnapshot
): {
  spentUsd: number | null;
  limitUsd: number | null;
  utilizationRatio: number | null;
  remainingPct: number | null;
  usedPct: number | null;
  canDispatch: boolean;
} {
  const spentRaw = planBudget?.spentUsd ?? planBudget?.usedUsd;
  const limitRaw =
    planBudget?.limitUsd !== undefined ? planBudget.limitUsd : (planBudget?.capUsd ?? null);

  const spentUsd =
    typeof spentRaw === "number" && Number.isFinite(spentRaw) ? Math.max(0, spentRaw) : null;
  const limitUsd =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : null;

  const utilizationRatio =
    spentUsd !== null && limitUsd !== null
      ? Math.max(0, Math.min(1, spentUsd / limitUsd))
      : intensity.budgetUtilizationRatio;

  const usedPct = utilizationRatio !== null ? Math.round(utilizationRatio * 100) : null;
  const remainingPct = usedPct !== null ? Math.max(0, 100 - usedPct) : null;
  const canDispatch =
    planBudget?.canDispatch ?? (utilizationRatio === null || utilizationRatio < 1);

  return {
    spentUsd,
    limitUsd,
    utilizationRatio,
    remainingPct,
    usedPct,
    canDispatch,
  };
}

function formatCompactUsd(amount: number): string {
  if (amount >= 10 && Number.isInteger(Number(amount.toFixed(2)))) {
    return `$${amount.toFixed(0)}`;
  }

  return `$${amount.toFixed(2)}`;
}

export function RabbitHoleSubagentMeshBar({
  subagents = [],
  processingIntensity: processingIntensityProp,
  planBudget = null,
  zeroDataRetention = false,
  defaultExpanded,
  defaultSelectedAgentId = null,
  className,
}: RabbitHoleSubagentMeshBarProps) {
  const activeCount = useMemo(
    () => subagents.filter((w) => w.status === "working" || w.status === "queued").length,
    [subagents]
  );
  const completedCount = useMemo(
    () => subagents.filter((w) => w.status === "done" || w.status === "complete").length,
    [subagents]
  );

  const processingIntensity = useMemo(() => {
    if (processingIntensityProp) return processingIntensityProp;

    const spentUsd = planBudget?.spentUsd ?? planBudget?.usedUsd;
    const limitUsd =
      planBudget?.limitUsd !== undefined ? planBudget.limitUsd : (planBudget?.capUsd ?? undefined);

    return computeLlmProcessingIntensity({
      activeSubagentCount: activeCount,
      completedSubagentCount: completedCount,
      planSpentUsd: spentUsd,
      planLimitUsd: limitUsd,
      zeroDataRetention,
    });
  }, [processingIntensityProp, activeCount, completedCount, planBudget, zeroDataRetention]);

  const [selectedKey, setSelectedKey] = useState<string | null>(defaultSelectedAgentId);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(
    defaultExpanded !== undefined ? defaultExpanded : null
  );

  const hasWorkers = subagents.length > 0;
  const isExpanded = manualExpanded !== null ? manualExpanded : selectedKey !== null;

  const selectedWorker = useMemo(() => {
    if (!hasWorkers) return null;
    if (selectedKey) {
      const match = subagents.find(
        (w, idx) => workerKey(w, idx) === selectedKey || w.name === selectedKey
      );

      if (match) return match;
    }
    if (isExpanded) {
      return (
        subagents.find((w) => w.status === "working" || w.status === "queued") ??
        subagents[0] ??
        null
      );
    }

    return null;
  }, [hasWorkers, isExpanded, selectedKey, subagents]);

  const budget = resolveBudgetNumbers(planBudget, processingIntensity);
  const isNearLimit =
    processingIntensity.tier === "limit-near" ||
    (budget.utilizationRatio !== null && budget.utilizationRatio >= 0.8);
  const isBlocked =
    !budget.canDispatch || (budget.utilizationRatio !== null && budget.utilizationRatio >= 1);

  const handlePillClick = (key: string) => {
    if (selectedKey === key && isExpanded) {
      setSelectedKey(null);
      setManualExpanded(false);
    } else {
      setSelectedKey(key);
      setManualExpanded(true);
    }
  };

  const handleToggleExpand = () => {
    const next = !isExpanded;

    setManualExpanded(next);
    if (next && !selectedKey && subagents.length > 0) {
      setSelectedKey(workerKey(subagents[0]!, 0));
    }
  };

  return (
    <section
      aria-label="Subagent mesh and processing telemetry"
      data-mesh-bar
      data-intensity-tier={processingIntensity.tier}
      data-mesh-expanded={isExpanded ? "true" : "false"}
      className={cn(
        "mb-2.5 shrink-0 overflow-hidden rounded-lg border transition-colors",
        glass(),
        isBlocked
          ? "border-destructive/40 bg-destructive/5"
          : isNearLimit
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border/35 bg-background-secondary/20",
        className
      )}
    >
      {/* Top compact strip: intensity-driven activity mark + status label + budget & ZDR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <OrganicActivityMark
            className="size-6 rounded-md"
            intensity={processingIntensity.intensity}
            intensityTier={processingIntensity.tier}
            label={`Organic processing intensity: ${processingIntensity.label}`}
            seed="rabbit-hole-mesh-orchestrator"
            size="sm"
            state={processingIntensity.markState}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span data-mesh-status-label className="truncate text-xs font-medium text-foreground">
                {processingIntensity.label}
              </span>
              {zeroDataRetention ? (
                <span
                  data-zdr-badge="true"
                  title="Zero Data Retention active"
                  className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300"
                >
                  <ShieldCheck aria-hidden className="size-2.5" />
                  ZDR
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {budget.utilizationRatio !== null ? (
            <div
              data-mesh-budget-gauge
              data-budget-tone={isBlocked ? "blocked" : isNearLimit ? "warning" : "normal"}
              className="flex items-center gap-1.5"
            >
              <span
                className={cn(
                  " font-mono text-[11px] tabular-nums",
                  isBlocked
                    ? "font-medium text-destructive"
                    : isNearLimit
                      ? "font-medium text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground"
                )}
              >
                {budget.spentUsd !== null && budget.limitUsd !== null
                  ? `${formatCompactUsd(budget.spentUsd)} / ${formatCompactUsd(budget.limitUsd)}`
                  : `${budget.usedPct}% used`}
              </span>
              <span className="sr-only">
                {budget.remainingPct}% remaining ({budget.usedPct}% used)
              </span>
              <div
                role="progressbar"
                aria-label="Weekly plan budget utilization"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={budget.usedPct ?? 0}
                className="h-1.5 w-10 overflow-hidden rounded-full bg-border/50"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none",
                    isBlocked ? "bg-destructive" : isNearLimit ? "bg-amber-500" : "bg-foreground/75"
                  )}
                  style={{ width: `${Math.min(100, budget.usedPct ?? 0)}%` }}
                />
              </div>
            </div>
          ) : null}

          {hasWorkers ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse subagent details" : "Expand subagent details"}
              onClick={handleToggleExpand}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {isExpanded ? (
                <ChevronDown aria-hidden className="size-3.5" />
              ) : (
                <ChevronRight aria-hidden className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Subagent worker pills (Lyra, Reed, Archer, etc.) */}
      {hasWorkers ? (
        <div
          role="toolbar"
          aria-label="Subagent mesh workers"
          className="flex flex-wrap items-center gap-1.5 border-t border-border/35 px-2.5 py-1.5"
        >
          {subagents.map((worker, index) => {
            const key = workerKey(worker, index);
            const isSelected =
              isExpanded && selectedWorker != null && workerKey(selectedWorker, -1) === key;
            const statusText = WORKER_STATUS_LABEL[worker.status] ?? worker.status;
            const isActiveWorker = worker.status === "working" || worker.status === "queued";

            return (
              <button
                key={key}
                type="button"
                data-subagent-pill={worker.name}
                data-subagent-status={worker.status}
                aria-pressed={isSelected}
                aria-label={`${worker.name}${worker.role ? ` (${worker.role})` : ""}: ${statusText}`}
                onClick={() => handlePillClick(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-xs transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isSelected
                    ? "border-foreground/30 bg-background text-foreground shadow-2xs"
                    : isActiveWorker
                      ? "border-accent/40 bg-accent/10 text-foreground hover:bg-accent/15"
                      : "border-border/50 bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isActiveWorker
                      ? "bg-emerald-500"
                      : worker.status === "blocked"
                        ? "bg-amber-500"
                        : worker.status === "done" || worker.status === "complete"
                          ? "bg-sky-500"
                          : "bg-muted-foreground/50"
                  )}
                />
                <span className="font-medium text-foreground">{worker.name}</span>
                {worker.role ? (
                  <span className="text-[11px] text-muted-foreground">· {worker.role}</span>
                ) : null}
                <span
                  className={cn(
                    "text-[11px]",
                    worker.status === "blocked"
                      ? "text-amber-700 dark:text-amber-300"
                      : isActiveWorker
                        ? "text-foreground/90"
                        : "text-muted-foreground"
                  )}
                >
                  {statusText}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Expanded subagent inspector drawer */}
      {isExpanded && selectedWorker ? (
        <div
          data-subagent-inspector={selectedWorker.name}
          className="space-y-1.5 border-t border-border/40 bg-background/50 px-3 py-2.5 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <OrganicActivityMark
                className="size-5 rounded"
                imageUrl={selectedWorker.identityImageUrl}
                intensity={
                  selectedWorker.status === "working" || selectedWorker.status === "queued"
                    ? Math.max(0.5, processingIntensity.intensity)
                    : processingIntensity.intensity
                }
                label={`${selectedWorker.name} activity mark`}
                seed={selectedWorker.activitySeed ?? selectedWorker.name}
                size="sm"
                state={workerMarkState(selectedWorker.status)}
              />
              <span className="font-medium text-foreground">{selectedWorker.name}</span>
              {selectedWorker.role ? (
                <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {selectedWorker.role}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {WORKER_STATUS_LABEL[selectedWorker.status] ?? selectedWorker.status}
            </span>
          </div>

          {workerBrief(selectedWorker) ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/80">Brief: </span>
              {workerBrief(selectedWorker)}
            </p>
          ) : null}

          {workerOutput(selectedWorker) ? (
            <div
              data-subagent-output
              className="rounded-lg border border-border/40 bg-background/80 px-2.5 py-2 text-xs leading-relaxed text-foreground"
            >
              {workerOutput(selectedWorker)}
            </div>
          ) : (
            <p className="text-[11px] italic text-muted-foreground">
              {selectedWorker.status === "working" || selectedWorker.status === "queued"
                ? `Working on assignment (${formatCompactTokenCount(Math.round(processingIntensity.intensity * 4000))} est. load)…`
                : "Awaiting output from subagent thread."}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
