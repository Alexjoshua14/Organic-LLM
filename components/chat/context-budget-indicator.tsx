"use client";

import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";

import { useMemo, useState } from "react";

import { glass } from "@/components/design-system/primitives";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/third-party/ui/hover-card";
import {
  formatTokenCount,
  getContextComposition,
  getContextHeadroomTurns,
  getThreadContextCoverage,
  type ContextBudgetSegment,
} from "@/lib/chat/context-budget";
import { AUTO_CHAT_MODEL_ID, ChatModels } from "@/lib/schemas/chat";
import { contextSegmentColor, contextUsageLabelColor } from "@/lib/design/kelvin-color";
import { useThreadContextBudget } from "@/hooks/use-thread-context-budget";
import { cn } from "@/lib/utils";
import { summarizeContextMemories } from "@/lib/chat/context-memory";
import { getActiveToolCategories } from "@/lib/chat/tool-categories";

type ContextBudgetIndicatorProps = {
  chatId?: string;
  modelId: string;
  draftText: string;
  contextMessageLimit?: number;
  memoryEnabled?: boolean;
  webSearchEnabled?: boolean;
  messageSearchEnabled?: boolean;
  experience?: ChatExperience;
  chatStyle?: ChatStyle;
  speechFriendly?: boolean;
  refreshKey?: number;
  streamBudget?: ContextBudgetEstimate | null;
  /** When set, compose locally from scaffold + these messages. */
  threadMessages?: UIMessage[];
  className?: string;
};

function formatModelLabel(modelId: string): string {
  return ChatModels.find((model) => model.id === modelId)?.name ?? modelId;
}

function formatResolvedModelLabel(budget: ContextBudgetEstimate): string {
  const resolvedId = budget.resolvedModelId ?? budget.modelId;

  if (budget.modelId === AUTO_CHAT_MODEL_ID && resolvedId !== budget.modelId) {
    return `Auto → ${formatModelLabel(resolvedId)}`;
  }

  return formatModelLabel(resolvedId);
}

function ToolCategoryPills({ toolNames }: { toolNames?: string[] }) {
  const categories = getActiveToolCategories(toolNames);

  if (categories.length === 0) return <span className="text-muted-foreground">None</span>;

  return (
    <ul
      aria-label="Enabled tool categories"
      className="flex max-w-[14rem] flex-wrap justify-end gap-1 font-sans"
    >
      {categories.map((category) => (
        <li
          key={category}
          className="inline-flex items-center rounded-full border border-border/60 bg-background-tertiary/40 px-1.5 py-px text-2xs font-medium text-foreground shadow-sm"
        >
          {category}
        </li>
      ))}
    </ul>
  );
}

function formatMemoriesLabel(budget: ContextBudgetEstimate): string {
  if (budget.memoryContext) {
    return String(summarizeContextMemories(budget.memoryContext).total);
  }
  return "Not recorded";
}

function formatUsageTokens(tokens: number | undefined): string {
  return tokens == null ? "Not reported" : `${tokens.toLocaleString()} tok`;
}

function formatCost(cost: number | undefined): string {
  if (cost == null) return "Not reported";
  if (cost === 0) return "$0.00";
  if (cost < 0.0001) return "<$0.0001";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(cost);
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className={cn("font-mono text-foreground", valueClassName)}>{value}</div>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function segmentSlices(segments: ContextBudgetSegment[], total: number, fillRatio: number) {
  if (total <= 0) return [];

  const used = segments.filter((segment) => segment.id !== "free");
  return used.map((segment) => {
    const pct = (segment.tokens / total) * 100;

    return {
      ...segment,
      pct,
      color: contextSegmentColor(segment.id, fillRatio),
    };
  });
}

/** Presentational ring. Exported for the CoreInput lab; production goes through the indicator. */
export function ContextDonut({
  budget,
  size = "sm",
  className,
}: {
  budget: ContextBudgetEstimate;
  size?: "xs" | "sm" | "lg";
  className?: string;
}) {
  const usedSegments = useMemo(
    () => segmentSlices(budget.segments, budget.inputBudgetTokens, budget.fillRatio),
    [budget]
  );
  const dimension = size === "lg" ? "size-24" : size === "sm" ? "size-5" : "size-3.5";
  const diameter = size === "lg" ? 96 : size === "sm" ? 20 : 14;
  const strokeWidth = size === "lg" ? 4 : 1.5;
  const radius = diameter / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;
  const pctLabel = Math.round(budget.fillRatio * 100);

  return (
    <div className={cn("relative shrink-0 rounded-full", dimension, className)}>
      <svg
        viewBox={`0 0 ${diameter} ${diameter}`}
        className="absolute inset-0 size-full overflow-visible -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          fill="none"
          stroke={contextSegmentColor("free", budget.fillRatio, 0.16)}
          strokeWidth={strokeWidth}
        />
        {usedSegments.map((segment) => {
          const length = (segment.pct / 100) * circumference;
          const offset = cursor;
          cursor += length;
          const geometry = {
            cx: diameter / 2,
            cy: diameter / 2,
            r: radius,
            fill: "none",
            strokeDasharray: `${length} ${circumference}`,
            strokeDashoffset: -offset,
          };

          return (
            <g key={segment.id}>
              <circle
                {...geometry}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                style={{
                  filter: `drop-shadow(0 0 2px ${contextSegmentColor(segment.id, budget.fillRatio, 0.4)})`,
                }}
              />
              <circle
                {...geometry}
                stroke="white"
                strokeOpacity={0.55}
                strokeWidth={strokeWidth / 3}
              />
            </g>
          );
        })}
      </svg>
      {size === "lg" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className="font-mono text-lg font-medium"
            style={{ color: contextUsageLabelColor(budget.fillRatio) }}
          >
            {pctLabel}%
          </span>
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">in use</span>
        </div>
      ) : null}
    </div>
  );
}

function ContextCompositionBar({ budget }: { budget: ContextBudgetEstimate }) {
  const rows = budget.segments.filter((segment) => segment.id !== "free");
  const total = rows.reduce((sum, segment) => sum + segment.tokens, 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((segment) => segment.id === selectedId);

  return (
    <div>
      <div className="flex h-6 w-full items-center" aria-label="Breakdown of used input tokens">
        {rows.map((segment) => (
          <button
            key={segment.id}
            type="button"
            aria-label={`${segment.label}: ${segment.tokens.toLocaleString()} estimated tokens`}
            title={`${segment.label} · ${segment.tokens.toLocaleString()} tokens`}
            aria-pressed={selectedId === segment.id}
            onMouseEnter={() => setSelectedId(segment.id)}
            onMouseLeave={() => setSelectedId(null)}
            onFocus={() => setSelectedId(segment.id)}
            onBlur={() => setSelectedId(null)}
            onClick={() => setSelectedId(segment.id)}
            className="relative h-full shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            style={{ width: `${total > 0 ? (segment.tokens / total) * 100 : 0}%` }}
          >
            <span
              className="pointer-events-none absolute inset-x-px top-1/2 h-1 -translate-y-1/2 rounded-full"
              style={{
                backgroundColor: contextSegmentColor(segment.id, budget.fillRatio),
                boxShadow: `0 0 4px ${contextSegmentColor(segment.id, budget.fillRatio, 0.4)}`,
              }}
            >
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 rounded-full bg-white/55" />
            </span>
          </button>
        ))}
      </div>
      <div
        className="-mt-1 h-8 text-xs leading-4 text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {selected ? (
          <>
            <span className="block truncate text-foreground">{selected.label}</span>
            <span className="block">
              <span className="font-mono">{selected.tokens.toLocaleString()} tok</span> ·{" "}
              {total > 0 ? Math.round((selected.tokens / total) * 100) : 0}% of input
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Hover-card body. Exported so the lab can pin it open while styling. */
export function ContextBudgetPopover({ budget }: { budget: ContextBudgetEstimate }) {
  const coverage = getThreadContextCoverage(budget);
  const composition = getContextComposition(budget);
  const headroomTurns = getContextHeadroomTurns(budget);
  const usage = budget.lastTurn?.usage;
  const memories = budget.memoryContext ? summarizeContextMemories(budget.memoryContext) : null;
  const cacheShare =
    usage?.cachedInputTokens != null && usage.inputTokens != null && usage.inputTokens > 0
      ? Math.round((usage.cachedInputTokens / usage.inputTokens) * 100)
      : null;

  return (
    <div className="space-y-stack-lg p-4">
      <div className="flex items-start gap-4">
        <ContextDonut budget={budget} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">Next send estimate</p>
          <p className="font-mono text-xs text-muted-foreground">
            {formatTokenCount(budget.nextSubmitTokens)} /{" "}
            {formatTokenCount(budget.inputBudgetTokens)} input tokens
          </p>
          {composition ? (
            <p className="text-xs text-muted-foreground">
              {composition.conversationPercent}% conversation · {composition.scaffoldingPercent}%
              scaffolding
            </p>
          ) : null}
          <ContextCompositionBar budget={budget} />
        </div>
      </div>

      <div className={cn("space-y-4 rounded-xl border border-border/50 p-3 text-[11px]", glass())}>
        {budget.lastTurn ? (
          <DetailGroup title="Last send">
            <DetailRow label="Input tokens" value={formatUsageTokens(usage?.inputTokens)} />
            <DetailRow
              label="Cached tokens"
              value={
                <>
                  {formatUsageTokens(usage?.cachedInputTokens)}
                  {cacheShare != null ? (
                    <span className="ml-1.5 text-muted-foreground">{cacheShare}%</span>
                  ) : null}
                </>
              }
            />
            <DetailRow label="Output tokens" value={formatUsageTokens(usage?.outputTokens)} />
            <DetailRow
              label="Cost"
              value={`${usage?.costSource === "estimate" ? "~" : ""}${formatCost(usage?.costUsd)}`}
            />
            <p className="text-2xs text-muted-foreground leading-relaxed">
              {usage
                ? `${usage.complete ? "Total" : "So far"} across ${usage.modelCalls} model ${usage.modelCalls === 1 ? "call" : "calls"}. Cached tokens are part of input.`
                : "Usage wasn't recorded for this send."}
              {usage?.costSource === "estimate" ? " Cost is estimated." : null}
            </p>
          </DetailGroup>
        ) : null}

        <DetailGroup title="In context">
          <DetailRow
            label="Thread in context"
            value={
              <>
                {coverage ? `${coverage.percent}%` : "—"}
                <span className="ml-1.5 text-muted-foreground">
                  {budget.packedMessageCount} / {budget.totalThreadMessages} msgs
                </span>
              </>
            }
          />
          <DetailRow label="Memories" value={formatMemoriesLabel(budget)} />
          {memories ? (
            <>
              <DetailRow label="Automatic retrieval" value={memories.automatic.toLocaleString()} />
              <DetailRow label="Fetched by tools" value={memories.tools.toLocaleString()} />
              {memories.overlap > 0 ? (
                <p className="text-2xs text-muted-foreground leading-relaxed">
                  {memories.overlap} {memories.overlap === 1 ? "memory appears" : "memories appear"}{" "}
                  in both sources; counted once in the total.
                </p>
              ) : null}
            </>
          ) : null}
          <DetailRow
            label="Tools armed"
            value={<ToolCategoryPills toolNames={budget.activeToolNames} />}
            valueClassName="font-sans text-right"
          />
          {budget.includesRollingSummary ? (
            <DetailRow
              label="Older turns"
              value="Compressed via rolling summary"
              valueClassName="font-sans text-foreground"
            />
          ) : null}
        </DetailGroup>

        <DetailGroup title="Capacity">
          <DetailRow
            label="Model"
            value={formatResolvedModelLabel(budget)}
            valueClassName="max-w-[11rem] truncate text-right"
          />
          <DetailRow
            label="Model window"
            value={`${formatTokenCount(budget.contextWindowTokens)} tok`}
          />
          <DetailRow
            label="Free input space"
            value={`${formatTokenCount(budget.remainingInputTokens)} tok`}
            valueClassName="font-medium text-foreground-secondary"
          />
          {headroomTurns != null ? (
            <DetailRow
              label="Headroom"
              value={`~${headroomTurns.toLocaleString()} turns`}
              valueClassName="font-medium text-foreground-secondary"
            />
          ) : null}
        </DetailGroup>
      </div>
    </div>
  );
}

/**
 * Badge + hover card for a resolved budget. No data fetching — the indicator below pairs
 * this with {@link useThreadContextBudget}; the CoreInput lab feeds it fixture budgets.
 */
export function ContextBudgetIndicatorView({
  budget,
  className,
}: {
  budget: ContextBudgetEstimate;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pctLabel = Math.round(budget.fillRatio * 100);
  const coverage = getThreadContextCoverage(budget);
  const resolvedModel = formatResolvedModelLabel(budget);
  const coverageLabel = coverage
    ? `${coverage.percent}% thread in context`
    : "thread coverage unavailable";

  return (
    <HoverCard closeDelay={80} openDelay={120} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <button
          aria-label={`Context usage ${pctLabel} percent, ${coverageLabel}, model ${resolvedModel}. Open context breakdown.`}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center rounded-md p-1 transition-colors",
            "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            className
          )}
          type="button"
        >
          <ContextDonut budget={budget} size="xs" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="end"
        className={cn(
          "w-[min(24rem,calc(100vw-2rem))] max-h-[min(42rem,var(--radix-hover-card-content-available-height))] overflow-y-auto overscroll-contain border-border/60 p-0",
          glass()
        )}
        side="top"
        sideOffset={10}
      >
        <ContextBudgetPopover budget={budget} />
      </HoverCardContent>
    </HoverCard>
  );
}

export const ContextBudgetIndicator: React.FC<ContextBudgetIndicatorProps> = ({
  chatId,
  modelId,
  draftText,
  memoryEnabled,
  webSearchEnabled,
  messageSearchEnabled,
  experience,
  chatStyle,
  speechFriendly,
  refreshKey,
  streamBudget,
  threadMessages,
  className,
}) => {
  const budget = useThreadContextBudget({
    chatId,
    modelId,
    draftText,
    memoryEnabled,
    webSearchEnabled,
    messageSearchEnabled,
    experience,
    chatStyle,
    speechFriendly,
    refreshKey,
    streamBudget,
    threadMessages,
    enabled: Boolean(chatId),
  });

  return <ContextBudgetIndicatorView budget={budget} className={className} />;
};
