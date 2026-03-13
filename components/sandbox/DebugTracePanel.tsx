"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineTrace } from "@/lib/sandbox/pipelines/trace";

export interface DebugTracePanelProps {
  trace: PipelineTrace | null;
  /** Extra keys from scenario getDebugData (e.g. title, branchesCount) */
  extra?: Record<string, unknown>;
  className?: string;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const str = value === undefined ? "undefined" : JSON.stringify(value, null, 2);
  const isLong = str.length > 120;

  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-1 w-full px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/50"
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

export function DebugTracePanel({ trace, extra, className }: DebugTracePanelProps) {
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
        type="button"
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span>Debug / trace</span>
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
      </button>
      {!collapsed && (
        <div className="p-4 space-y-3 border-t border-border">
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Model / function
            </span>
            <p className="text-sm text-foreground">{trace.modelOrFunction}</p>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Latency
            </span>
            <p className="text-sm text-foreground">{trace.latencyMs.toFixed(0)} ms</p>
          </div>
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
              <span className="text-xs font-medium text-muted-foreground">
                Transformed prompt
              </span>
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
