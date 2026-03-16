"use client";

import { useMemo } from "react";
import { Type, DollarSign, Clock, Volume2 } from "lucide-react";
import { Tooltip } from "@heroui/tooltip";

import {
  calculateTokenUsage,
  formatCost,
  formatNumber,
  formatDuration,
  formatAudioDuration,
  TTSModel,
} from "@/lib/tts/token-calculator";
import { glass } from "@/components/design-system/primitives";

type TokenUsageDisplayProps = {
  text: string;
  model: TTSModel;
  className?: string;
  showTime?: boolean;
};

/**
 * TokenUsageDisplay - A beautiful, low-key component that shows token usage and cost estimates
 * for TTS generation. Provides readily viewable deeper insight without calling for attention.
 */
export function TokenUsageDisplay({
  text,
  model,
  className = "",
  showTime = true,
}: TokenUsageDisplayProps) {
  const usageData = useMemo(() => {
    if (!text.trim()) {
      return null;
    }

    return calculateTokenUsage(text, model);
  }, [text, model]);

  if (!usageData || usageData.characterCount === 0) {
    return null;
  }

  const metrics = [
    {
      icon: Type,
      label: "Characters",
      value: formatNumber(usageData.characterCount),
      tooltip: `Total character count in your text`,
      color: "text-blue-500/80",
    },
    {
      icon: DollarSign,
      label: "Est. Cost",
      value: formatCost(usageData.estimatedCost),
      tooltip: `Estimated cost at ${formatCost(usageData.costPerUnit / 1_000_000)} per character`,
      color: "text-emerald-500/80",
    },
    ...(showTime
      ? [
          {
            icon: Clock,
            label: "Gen. Time",
            value: formatDuration(usageData.estimatedDurationMs),
            tooltip: `Estimated time to generate audio`,
            color: "text-amber-500/80",
          },
          {
            icon: Volume2,
            label: "Audio",
            value: formatAudioDuration(usageData.estimatedAudioDurationSec),
            tooltip: `Estimated audio duration`,
            color: "text-purple-500/80",
          },
        ]
      : []),
  ];

  return (
    <div
      className={`
        ${glass()} 
        rounded-lg 
        px-4 py-2.5 
        border border-white/10
        backdrop-blur-md
        ${className}
      `}
    >
      <div className="flex items-center gap-4 md:gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;

          return (
            <Tooltip
              key={metric.label}
              classNames={{
                base: "backdrop-blur-md",
                content: "bg-background/95 border border-border/50 text-xs",
              }}
              content={metric.tooltip}
              delay={300}
            >
              <div
                className={`
                  flex items-center gap-2 
                  ${index !== metrics.length - 1 ? "border-r border-border/30 pr-4 md:pr-6" : ""}
                  cursor-help
                  transition-all duration-200
                  hover:scale-105
                `}
              >
                <Icon className={`w-3.5 h-3.5 ${metric.color} opacity-70`} strokeWidth={2.5} />
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium leading-none">
                    {metric.label}
                  </span>
                  <span className="text-sm font-semibold text-foreground/90 leading-tight mt-0.5 tabular-nums">
                    {metric.value}
                  </span>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/**
 * CompactTokenUsageDisplay - An even more minimal version for tight spaces
 */
export function CompactTokenUsageDisplay({ text, model, className = "" }: TokenUsageDisplayProps) {
  const usageData = useMemo(() => {
    if (!text.trim()) {
      return null;
    }

    return calculateTokenUsage(text, model);
  }, [text, model]);

  if (!usageData || usageData.characterCount === 0) {
    return null;
  }

  return (
    <Tooltip
      classNames={{
        base: "backdrop-blur-md",
        content: "bg-background/95 border border-border/50 text-xs",
      }}
      content={
        <div className="space-y-1 py-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Characters:</span>
            <span className="font-semibold tabular-nums">
              {formatNumber(usageData.characterCount)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Est. Tokens:</span>
            <span className="font-semibold tabular-nums">
              {formatNumber(usageData.estimatedTokens)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Est. Cost:</span>
            <span className="font-semibold tabular-nums">
              {formatCost(usageData.estimatedCost)}
            </span>
          </div>
        </div>
      }
      delay={200}
    >
      <div
        className={`
          ${glass()} 
          rounded-md 
          px-3 py-1.5 
          border border-white/10
          backdrop-blur-md
          flex items-center gap-2
          cursor-help
          transition-all duration-200
          hover:border-white/20
          ${className}
        `}
      >
        <DollarSign className="w-3 h-3 text-emerald-500/70" strokeWidth={2.5} />
        <span className="text-xs font-semibold text-foreground/80 tabular-nums">
          {formatCost(usageData.estimatedCost)}
        </span>
      </div>
    </Tooltip>
  );
}
