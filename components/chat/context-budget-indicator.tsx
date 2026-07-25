"use client";

import { useMemo } from "react";

import { glass } from "@/components/design-system/primitives";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/third-party/ui/hover-card";
import type { ChatExperience } from "@/lib/chat/chat-experience";
import type { ChatStyle } from "@/lib/chat/chat-style";
import type { ContextBudgetEstimate } from "@/lib/chat/context-budget";
import {
  formatTokenCount,
  type ContextBudgetSegment,
} from "@/lib/chat/context-budget";
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
  className?: string;
};

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
  size?: "sm" | "lg";
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
  const dimension = size === "sm" ? "size-5" : "size-24";
  const holeInset = size === "sm" ? "inset-[4px]" : "inset-[14px]";
  const pctLabel = Math.round(budget.fillRatio * 100);

  return (
    <div
      className={cn("relative shrink-0 rounded-full", dimension, className)}
      style={{
        background: gradient,
        boxShadow:
          budget.fillRatio >= 0.75
            ? `0 0 ${size === "sm" ? 6 : 14}px ${kelvinToCss(fillKelvin, 0.35)}`
            : undefined,
      }}
    >
      <div className={cn("absolute rounded-full bg-background", holeInset)} />
      {size === "lg" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-lg font-medium" style={{ color: fillColor }}>
            {pctLabel}%
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">in use</span>
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
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {budget.source === "server"
              ? "Measured from the same context assembly the server uses on send."
              : "New thread baseline — system prompt and active tools until the first server snapshot."}
          </p>
        </div>
      </div>

      <SegmentLegend budget={budget} />

      <div className={cn("space-y-2 rounded-xl border border-border/50 p-3 text-[11px]", glass())}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Thread in view</span>
          <span className="font-mono text-foreground">
            {budget.packedMessageCount} / {budget.totalThreadMessages} messages
          </span>
        </div>
        {budget.includesRollingSummary ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Older turns</span>
            <span className="text-foreground">Compressed via rolling summary</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Reserved for reply</span>
          <span className="font-mono text-foreground">
            {formatTokenCount(budget.reservedOutputTokens)} tok
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Model window</span>
          <span className="font-mono text-foreground">
            {formatTokenCount(budget.contextWindowTokens)} tok
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-2">
          <span className="font-medium text-foreground">Free input space</span>
          <span
            className="font-mono font-medium"
            style={{ color: kelvinToCss(contextSegmentKelvin("free", budget.fillRatio), 0.95) }}
          >
            {formatTokenCount(budget.remainingInputTokens)} tok
          </span>
        </div>
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
    enabled: Boolean(chatId),
  });

  const pctLabel = Math.round(budget.fillRatio * 100);
  const fillKelvin = contextFillKelvin(budget.fillRatio);
  const fillColor = kelvinToCss(fillKelvin);

  return (
    <HoverCard closeDelay={80} openDelay={120}>
      <HoverCardTrigger asChild>
        <button
          aria-label={`Context usage ${pctLabel} percent at ${Math.round(fillKelvin)} kelvin. Hover for breakdown.`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs transition-colors",
            "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            className
          )}
          type="button"
        >
          <ContextDonut budget={budget} />
          <span
            className="hidden font-mono tabular-nums sm:inline"
            style={{ color: fillColor }}
          >
            {pctLabel}%
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="end"
        className={cn("w-[min(22rem,calc(100vw-2rem))] overflow-hidden border-border/60 p-0", glass())}
        side="top"
        sideOffset={10}
      >
        <ContextBudgetPopover budget={budget} />
      </HoverCardContent>
    </HoverCard>
  );
};

