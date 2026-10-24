"use client";

import { useState } from "react";

import { glass } from "@/components/design-system/primitives";
import { useAionPresenceStore } from "@/lib/aion/presence/event-bus";
import { cn } from "@/lib/utils";

function formatUsd(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";

  if (value < 0.01) return `$${value.toFixed(4)}`;

  return `$${value.toFixed(2)}`;
}

/**
 * Glass drawer for the Aion presence sandbox: last tier decisions, coalesce state,
 * turns/USD today, and last-turn tokens + ms. Pattern mirrors the perf HUD.
 */
export function AionPresenceHud({ className }: { className?: string }) {
  const [open, setOpen] = useState(true);
  const decisions = useAionPresenceStore((s) => s.decisions);
  const budget = useAionPresenceStore((s) => s.budget);
  const lastTurn = useAionPresenceStore((s) => s.lastTurn);
  const phase = useAionPresenceStore((s) => s.phase);
  const busy = useAionPresenceStore((s) => s.busy);
  const dormant = useAionPresenceStore((s) => s.dormant);
  const modelId = useAionPresenceStore((s) => s.modelId);
  const threadId = useAionPresenceStore((s) => s.threadId);
  const lastCoalesceKey = useAionPresenceStore((s) => s.lastCoalesceKey);

  const recent = [...decisions].reverse().slice(0, 8);
  const microCount = decisions.filter((d) => d.tier === "micro").length;
  const noneCount = decisions.filter((d) => d.tier === "none").length;

  return (
    <div
      className={cn("fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] text-xs", className)}
    >
      <div className={cn(glass({ opaque: true }), "rounded-xl border border-border/60 shadow-lg")}>
        <button
          className="flex w-full items-center justify-between px-3 py-2 text-left font-medium"
          type="button"
          onClick={() => setOpen((v) => !v)}
        >
          <span>Aion presence</span>
          <span className="text-muted-foreground">
            {phase}
            {busy ? " · busy" : ""}
            {dormant ? " · dormant" : ""}
            {open ? " ▾" : " ▸"}
          </span>
        </button>

        {open ? (
          <div className="space-y-3 border-t border-border/50 px-3 py-3">
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                <div className="text-[10px] uppercase tracking-wide">Turns today</div>
                <div className="text-foreground">
                  {budget ? `${budget.dailyTurnsUsed} / ${budget.dailyTurnCap}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide">USD today</div>
                <div className="text-foreground">
                  {budget
                    ? `${formatUsd(budget.dailyCostUsedUsd)} / ${formatUsd(budget.dailyCostCapUsd)}`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide">Per-minute</div>
                <div className="text-foreground">
                  {budget ? `${budget.perMinuteRemaining} left / ${budget.perMinuteCap}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide">Session</div>
                <div className="text-foreground">
                  micro {microCount} · none {noneCount}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Last turn
              </div>
              {lastTurn ? (
                <div className="rounded-md bg-background/50 px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                  <div>{lastTurn.silent ? "[silent]" : (lastTurn.text ?? "—")}</div>
                  <div className="text-muted-foreground">
                    {lastTurn.totalTokens ?? 0} tok · {lastTurn.durationMs ?? 0} ms ·{" "}
                    {formatUsd(lastTurn.costUsd)}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No micro-turns yet</div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Decisions
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px]">
                {recent.length === 0 ? (
                  <li className="text-muted-foreground">Emit an event to see tiers</li>
                ) : (
                  recent.map((d, i) => (
                    <li key={`${d.at}-${i}`} className="flex justify-between gap-2">
                      <span className="truncate">
                        <span className="text-foreground">{d.tier}</span>{" "}
                        <span className="text-muted-foreground">{d.reason}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">{d.label}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="truncate text-[10px] text-muted-foreground">
              model {modelId ?? "—"} · coalesce {lastCoalesceKey ?? "—"} · thread{" "}
              {threadId ? `${threadId.slice(0, 8)}…` : "—"}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
