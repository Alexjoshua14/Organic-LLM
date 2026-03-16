"use client";

import type { PipelineTrace, TokenUsage, TokenUsageEntry } from "@/lib/sandbox/pipelines/trace";

import { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/third-party/ui/tooltip";

export interface DebugTracePanelProps {
  trace: PipelineTrace | null;
  /** Extra keys from scenario getDebugData (e.g. title, branchesCount) */
  extra?: Record<string, unknown>;
  className?: string;
  /** Tooltip text for the panel header */
  headerTooltip?: string;
}

function formatTokens(n: number | undefined): string {
  if (n == null) return "—";

  return n.toLocaleString();
}

function TokenUsageRow({ label, usage }: { label: string; usage: TokenUsage }) {
  const input = usage.inputTokens ?? usage.promptTokens ?? 0;
  const output = usage.outputTokens ?? usage.completionTokens ?? 0;
  const total = usage.totalTokens ?? (input + output || undefined);
  const reasoning = usage.reasoningTokens;

  return (
    <div className="rounded-md border border-border/50 bg-card/30 p-2 text-xs">
      <div className="font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-foreground">
        <span>Input</span>
        <span>{formatTokens(input || undefined)}</span>
        <span>Output</span>
        <span>{formatTokens(output || undefined)}</span>
        {total != null && total > 0 && (
          <>
            <span>Total</span>
            <span>{formatTokens(total)}</span>
          </>
        )}
        {reasoning != null && reasoning > 0 && (
          <>
            <span>Reasoning</span>
            <span>{formatTokens(reasoning)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const str = value === undefined ? "undefined" : JSON.stringify(value, null, 2);
  const isLong = str.length > 120;

  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      <button
        className="flex items-center gap-1 w-full px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        {isLong ? open ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : null}
        <span>{label}</span>
      </button>
      <pre
        className={cn(
          "px-3 pb-2 pt-0 text-xs text-foreground/90 overflow-x-auto",
          isLong && !open && "line-clamp-2"
        )}
      >
        {str}
      </pre>
    </div>
  );
}

export function DebugTracePanel({ trace, extra, className, headerTooltip }: DebugTracePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!trace) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground",
          className
        )}
      >
        No run yet. Execute a scenario to see the trace.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 overflow-hidden flex flex-col",
        className
      )}
    >
      <button
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
        type="button"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="flex items-center gap-1.5">
          Debug / trace
          {headerTooltip != null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex cursor-help text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <HelpCircle aria-hidden size={14} />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="left">
                {headerTooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
      </button>
      {!collapsed && (
        <div className="p-4 space-y-3 border-t border-border">
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Model / function</span>
            <p className="text-sm text-foreground">{trace.modelOrFunction}</p>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">Latency</span>
            <p className="text-sm text-foreground">{trace.latencyMs.toFixed(0)} ms</p>
          </div>
          {(trace.tokenUsage != null || (trace.tokenUsageByCall?.length ?? 0) > 0) && (
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Token usage</span>
              <div className="space-y-2">
                {trace.tokenUsageByCall != null && trace.tokenUsageByCall.length > 0 ? (
                  trace.tokenUsageByCall.map((entry: TokenUsageEntry, i: number) => (
                    <TokenUsageRow
                      key={`${entry.modelOrFunction}-${i}`}
                      label={entry.modelOrFunction}
                      usage={entry.usage}
                    />
                  ))
                ) : trace.tokenUsage != null ? (
                  <TokenUsageRow label={trace.modelOrFunction} usage={trace.tokenUsage} />
                ) : null}
              </div>
            </div>
          )}
          {trace.error != null && (
            <div className="grid gap-1">
              <span className="text-xs font-medium text-destructive">Error</span>
              <p className="text-sm text-destructive">{trace.error}</p>
              {trace.errorStack && (
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {trace.errorStack}
                </pre>
              )}
            </div>
          )}
          <JsonBlock label="Raw input" value={trace.rawInput} />
          {trace.transformedPrompt != null && (
            <div className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Transformed prompt</span>
              <pre className="text-xs text-foreground whitespace-pre-wrap bg-card/50 p-2 rounded">
                {trace.transformedPrompt}
              </pre>
            </div>
          )}
          {trace.intermediateOutputs != null && (
            <JsonBlock label="Intermediate outputs" value={trace.intermediateOutputs} />
          )}
          {trace.normalizedProps != null && (
            <JsonBlock label="Normalized props" value={trace.normalizedProps} />
          )}
          {extra != null && Object.keys(extra).length > 0 && (
            <JsonBlock label="Extra" value={extra} />
          )}
        </div>
      )}
    </div>
  );
}
