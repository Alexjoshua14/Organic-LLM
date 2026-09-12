"use client";

import type { UIMessage } from "ai";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";

import { useMemo } from "react";

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
import {
  contextArcKelvin,
  contextFillKelvin,
  contextSegmentKelvin,
  kelvinToCss,
} from "@/lib/design/kelvin-color";
import { useThreadContextBudget } from "@/hooks/use-thread-context-budget";
import { cn } from "@/lib/utils";

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

function formatActiveToolsLabel(toolNames: string[] | undefined): string {
  if (!toolNames || toolNames.length === 0) return "None";

  const preview = toolNames.slice(0, 3).join(", ");

  return toolNames.length > 3 ? `${preview} +${toolNames.length - 3}` : preview;
}

function formatMemoriesLabel(budget: ContextBudgetEstimate): string {
  if (budget.memoriesInjected != null) {
    return String(budget.memoriesInjected);
  }

  const memoryTokens = budget.segments.find((segment) => segment.id === "memory")?.tokens ?? 0;

  return memoryTokens > 0 ? "Estimated" : "0";
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
      <span className={cn("font-mono text-foreground", valueClassName)}>{value}</span>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function segmentSlices(segments: ContextBudgetSegment[], total: number, fillRatio: number) {
  if (total <= 0) return [];

  const used = segments.filter((segment) => segment.id !== "free");
  const usedTokens = used.reduce((sum, segment) => sum + segment.tokens, 0);
  let arcCursor = 0;

  return used.map((segment) => {
    const pct = (segment.tokens / total) * 100;
    const arcShare = usedTokens > 0 ? segment.tokens / usedTokens : 0;
    const arcMid = arcCursor + arcShare / 2;

    arcCursor += arcShare;

    return {
      ...segment,
      pct,
      color: kelvinToCss(contextArcKelvin(arcMid, fillRatio), 0.9),
    };
  });
}

function buildConicGradient(
  segments: ReturnType<typeof segmentSlices>,
  fillRatio: number,
  remainingTokens: number,
  total: number
): string {
  if (segments.length === 0) {
    return `conic-gradient(${kelvinToCss(contextFillKelvin(fillRatio), 0.15)} 0deg 360deg)`;
  }

  let cursor = 0;

  const stops = segments.map((segment) => {
    const start = cursor;

    cursor += segment.pct;

    return `${segment.color} ${start}% ${cursor}%`;
  });

  if (remainingTokens > 0 && total > 0) {
    const freePct = (remainingTokens / total) * 100;
    const freeColor = kelvinToCss(contextSegmentKelvin("free", fillRatio), 0.14);

    stops.push(`${freeColor} ${cursor}% ${cursor + freePct}%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}

function ContextDonut({
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
  const gradient = buildConicGradient(
    usedSegments,
    budget.fillRatio,
    budget.remainingInputTokens,
    budget.inputBudgetTokens
  );
  const fillKelvin = contextFillKelvin(budget.fillRatio);
  const fillColor = kelvinToCss(fillKelvin);
  const dimension = size === "lg" ? "size-24" : size === "sm" ? "size-5" : "size-3.5";
  // Ring thickness has to shrink with the donut or the xs variant reads as a solid dot.
  const holeInset =
    size === "lg" ? "inset-[14px]" : size === "sm" ? "inset-[4px]" : "inset-[2.5px]";
  const glowBlur = size === "lg" ? 14 : size === "sm" ? 6 : 5;
  const pctLabel = Math.round(budget.fillRatio * 100);

  return (
    <div
      className={cn("relative shrink-0 rounded-full", dimension, className)}
      style={{
        background: gradient,
        boxShadow:
          budget.fillRatio >= 0.75
            ? `0 0 ${glowBlur}px ${kelvinToCss(fillKelvin, 0.35)}`
            : undefined,
      }}
    >
      <div className={cn("absolute rounded-full bg-background", holeInset)} />
      {size === "lg" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-lg font-medium" style={{ color: fillColor }}>
            {pctLabel}%
          </span>
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">in use</span>
        </div>
      ) : null}
    </div>
  );
}

function SegmentLegend({ budget }: { budget: ContextBudgetEstimate }) {
  const rows = budget.segments.filter((segment) => segment.id !== "free");

  return (
    <ul className="space-y-2">
      {rows.map((segment) => {
        const share =
          budget.inputBudgetTokens > 0
            ? Math.round((segment.tokens / budget.inputBudgetTokens) * 100)
            : 0;
        const segmentColor = kelvinToCss(contextSegmentKelvin(segment.id, budget.fillRatio), 0.92);

        return (
          <li key={segment.id} className="flex items-center gap-2.5">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: segmentColor }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-foreground">{segment.label}</span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  {formatTokenCount(segment.tokens)}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${share}%`,
                    backgroundColor: segmentColor,
                  }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ContextBudgetPopover({ budget }: { budget: ContextBudgetEstimate }) {
  const coverage = getThreadContextCoverage(budget);
  const composition = getContextComposition(budget);
  const headroomTurns = getContextHeadroomTurns(budget);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start gap-4">
        <ContextDonut budget={budget} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">Context on next send</p>
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
        </div>
      </div>

      <SegmentLegend budget={budget} />

      <div className={cn("space-y-4 rounded-xl border border-border/50 p-3 text-[11px]", glass())}>
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
          <DetailRow label="Memories injected" value={formatMemoriesLabel(budget)} />
          <DetailRow
            label="Tools armed"
            value={formatActiveToolsLabel(budget.activeToolNames)}
            valueClassName="max-w-[11rem] truncate text-right"
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

  const pctLabel = Math.round(budget.fillRatio * 100);
  const fillKelvin = contextFillKelvin(budget.fillRatio);
  const coverage = getThreadContextCoverage(budget);
  const resolvedModel = formatResolvedModelLabel(budget);
  const coverageLabel = coverage
    ? `${coverage.percent}% thread in context`
    : "thread coverage unavailable";

  return (
    <HoverCard closeDelay={80} openDelay={120}>
      <HoverCardTrigger asChild>
        <button
          aria-label={`Context usage ${pctLabel} percent, ${coverageLabel}, model ${resolvedModel}, at ${Math.round(fillKelvin)} kelvin. Hover for breakdown.`}
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
          "w-[min(22rem,calc(100vw-2rem))] overflow-hidden border-border/60 p-0",
          glass()
        )}
        side="top"
        sideOffset={10}
      >
        <ContextBudgetPopover budget={budget} />
      </HoverCardContent>
    </HoverCard>
  );
};
