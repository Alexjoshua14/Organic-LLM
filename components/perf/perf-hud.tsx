"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { PERF_JOURNEY_LABELS, PERF_PHASE_LABELS, type PerfJourneyId } from "@/lib/perf/journeys";
import {
  clearPerfTraces,
  getPerfSnapshot,
  subscribePerfTraces,
  type PerfTrace,
} from "@/lib/perf/trace-store";
import { cn } from "@/lib/utils";

const HUD_OPEN_STORAGE_KEY = "ol:perf-hud-open";

function fmtMs(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";

  return n.toFixed(digits);
}

function phaseLabel(name: string): string {
  return PERF_PHASE_LABELS[name] ?? name;
}

function TraceRow({
  trace,
  expanded,
  onToggle,
}: {
  trace: PerfTrace;
  expanded: boolean;
  onToggle: () => void;
}) {
  const headline =
    trace.headlineMs != null
      ? `${fmtMs(trace.headlineMs)} ms`
      : trace.status === "abandoned"
        ? "abandoned"
        : "…";

  return (
    <div className="border-border/40 border-b last:border-b-0">
      <button
        className="flex w-full items-start justify-between gap-2 px-1 py-2 text-left hover:bg-muted/30"
        type="button"
        onClick={onToggle}
      >
        <div className="min-w-0">
          <p className="font-medium text-foreground/90 text-xs">
            {PERF_JOURNEY_LABELS[trace.journey as PerfJourneyId] ?? trace.journey}
            <span className="ml-1.5 font-normal text-muted-foreground">· {trace.trigger}</span>
          </p>
          <p className="mt-0.5 truncate text-muted-foreground text-2xs">{trace.pathAtStart}</p>
        </div>
        <span className="shrink-0 font-mono text-foreground/90 text-xs tabular-nums">
          {headline}
        </span>
      </button>
      {expanded ? (
        <div className="space-y-2 px-1 pb-2 font-mono text-2xs leading-relaxed text-foreground/85">
          {trace.marks.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-muted-foreground uppercase tracking-wide">
                Client
              </p>
              {trace.marks.map((m, i) => {
                const prev = i > 0 ? trace.marks[i - 1]!.t : 0;
                const delta = m.t - prev;

                return (
                  <p key={`${m.name}-${i}`} className="break-all">
                    <span className="text-muted-foreground">+{fmtMs(m.t)}</span>
                    <span className="text-muted-foreground/70"> Δ{fmtMs(delta)}</span>
                    {" · "}
                    {phaseLabel(m.name)}
                  </p>
                );
              })}
            </div>
          ) : null}
          {trace.serverPhases.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-muted-foreground uppercase tracking-wide">
                Server
              </p>
              {trace.serverPhases.map((p) => (
                <p key={p.name} className="break-all">
                  <span className="text-muted-foreground">{fmtMs(p.ms, 1)} ms</span>
                  {" · "}
                  {phaseLabel(p.name)}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PerfHud() {
  const panelId = useId();
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const snapshot = useSyncExternalStore(subscribePerfTraces, getPerfSnapshot, () => ({
    active: null,
    traces: [],
  }));

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(HUD_OPEN_STORAGE_KEY);

      if (v === "0") setOpen(false);
    } catch {
      // ignore
    }
  }, []);

  const setOpenPersist = useCallback((next: boolean) => {
    setOpen(next);

    try {
      sessionStorage.setItem(HUD_OPEN_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  const allTraces = snapshot.active ? [snapshot.active, ...snapshot.traces] : snapshot.traces;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(allTraces, null, 2));
    } catch {
      // ignore
    }
  }, [allTraces]);

  if (!open) {
    return (
      <button
        aria-controls={panelId}
        aria-expanded={false}
        aria-label="Open perf debug panel"
        className={cn(
          glass({ opaque: true }),
          "pointer-events-auto fixed top-24 right-0 z-[60] flex w-9 flex-col items-center gap-1.5 rounded-l-lg border border-border/60 border-r-0 py-3 pl-1 pr-0.5 shadow-lg backdrop-blur-xl",
          "text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        )}
        type="button"
        onClick={() => setOpenPersist(true)}
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="font-medium text-2xs text-foreground/80 uppercase tracking-widest [writing-mode:vertical-rl]">
          Perf
        </span>
      </button>
    );
  }

  return (
    <aside
      id={panelId}
      aria-label="Performance journey debug HUD"
      className={cn(
        glass({ opaque: true }),
        "pointer-events-auto fixed top-20 right-0 z-[60] flex max-h-[min(80vh,32rem)] w-[min(100vw-1rem,20rem)] flex-col rounded-l-xl rounded-r-none border border-border/60 border-r-0 shadow-lg backdrop-blur-xl sm:top-24"
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-border/40 border-b p-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground/90 text-sm">Perf journeys</p>
          <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
            Add <code className="text-2xs">?perf=0</code> to disable.
          </p>
        </div>
        <Button
          aria-controls={panelId}
          aria-expanded
          className="size-8 shrink-0 p-0"
          size="icon"
          title="Collapse perf panel"
          type="button"
          variant="ghost"
          onClick={() => setOpenPersist(false)}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {allTraces.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-xs">No traces yet.</p>
        ) : (
          allTraces.map((trace) => (
            <TraceRow
              key={trace.id}
              expanded={expandedId === trace.id}
              trace={trace}
              onToggle={() => setExpandedId((id) => (id === trace.id ? null : trace.id))}
            />
          ))
        )}
      </div>

      <div className="flex shrink-0 gap-1 border-border/40 border-t p-2">
        <Button
          className="h-7 flex-1 text-xs"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => void handleCopy()}
        >
          Copy JSON
        </Button>
        <Button
          className="h-7 flex-1 text-xs"
          size="sm"
          type="button"
          variant="outline"
          onClick={() => {
            clearPerfTraces();
            setExpandedId(null);
          }}
        >
          Clear
        </Button>
      </div>
    </aside>
  );
}
