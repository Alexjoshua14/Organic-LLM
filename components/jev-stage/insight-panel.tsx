"use client";

import type { JevStageTurnInsight } from "@/lib/jev-stage/schema";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Popover } from "radix-ui";

import { glass } from "@/components/design-system/primitives";
import { formatUsd } from "@/lib/usage/format";
import { cn } from "@/lib/utils";

function ConfidenceBars({ insight }: { insight: JevStageTurnInsight }) {
  const ranked = useMemo(
    () => [...insight.candidates].sort((a, b) => b.confidence - a.confidence),
    [insight.candidates]
  );
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="space-y-1">
      {top.map((candidate) => (
        <div key={`${candidate.kind}-${candidate.reason}`} className="flex items-center gap-2">
          <span className="w-24 truncate text-2xs text-muted-foreground">{candidate.kind}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn(
                "h-full rounded-full bg-foreground/70",
                candidate.kind === insight.selected.kind && "bg-primary"
              )}
              style={{ width: `${Math.round(candidate.confidence * 100)}%` }}
            />
          </div>
          <span className="w-8 text-right text-2xs tabular-nums text-muted-foreground">
            {candidate.confidence.toFixed(2)}
          </span>
        </div>
      ))}
      {rest.length > 0 && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              className="text-2xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              type="button"
            >
              +{rest.length} more
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              className={cn(glass({ opaque: true }), "z-50 w-64 rounded-xl p-3 text-2xs shadow-xl")}
              sideOffset={6}
            >
              <ul className="space-y-1.5">
                {rest.map((candidate) => (
                  <li key={`${candidate.kind}-${candidate.reason}`}>
                    <span className="font-medium">{candidate.kind}</span>{" "}
                    <span className="tabular-nums text-muted-foreground">
                      {candidate.confidence.toFixed(2)}
                    </span>
                    <div className="text-muted-foreground">{candidate.reason}</div>
                  </li>
                ))}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}

function Glance({ insight }: { insight: JevStageTurnInsight }) {
  const models = Object.entries(insight.perModelSpendUsd);

  return (
    <div className="grid grid-cols-3 gap-1 text-2xs tabular-nums text-muted-foreground">
      <div>
        <div className="text-foreground/80">{formatUsd(insight.totals.costUsd)}</div>
        <div>total</div>
      </div>
      <div>
        <div className="text-foreground/80">{insight.totals.latencyMs}ms</div>
        <div>latency</div>
      </div>
      <div>
        <div className="text-foreground/80">{insight.totals.cachedInputTokens}</div>
        <div>cached tok</div>
      </div>
      <div className="col-span-3 flex flex-wrap gap-x-2 gap-y-0.5">
        <span>
          in {insight.totals.inputTokens} / out {insight.totals.outputTokens}
        </span>
        {models.map(([model, spend]) => (
          <span key={model}>
            {model.split("/").pop()}: {formatUsd(spend)}
          </span>
        ))}
        {insight.calls[0]?.tokensPerSecond != null && (
          <span>{insight.calls[0].tokensPerSecond} tok/s</span>
        )}
        {insight.outcome === "limit_error" && (
          <span className="text-destructive">output budget hit</span>
        )}
      </div>
    </div>
  );
}

export function JevStageInsightPanel({
  insights,
  onEval,
  className,
}: {
  insights: JevStageTurnInsight[];
  onEval: (turnId: string, signal: "up" | "down", note?: string | null) => Promise<void>;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [note, setNote] = useState("");
  const safeIndex = Math.min(index, Math.max(0, insights.length - 1));
  const insight = insights[safeIndex] ?? null;

  const body = !insight ? (
    <p className="text-2xs text-muted-foreground">Send a message to see Jev’s routing insight.</p>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="line-clamp-2 text-2xs leading-snug text-muted-foreground">{insight.userMessage}</p>
      <div className="rounded-lg border border-border/50 bg-background/40 px-2 py-1.5">
        <div className="text-2xs font-medium text-foreground">
          {insight.selected.kind}
          {insight.fellBack ? " · fallback" : ""}
        </div>
        <div className="text-2xs text-muted-foreground">{insight.selected.reason}</div>
      </div>
      <ConfidenceBars insight={insight} />
      <Glance insight={insight} />
      <div className="mt-auto flex items-center gap-1 border-t border-border/40 pt-2">
        {(["up", "down"] as const).map((signal) => {
          const Icon = signal === "up" ? ThumbsUp : ThumbsDown;

          return (
            <button
              key={signal}
              aria-label={signal === "up" ? "Good turn" : "Bad turn"}
              aria-pressed={insight.eval.signal === signal}
              className={cn(
                "rounded-lg p-1.5 text-muted-foreground hover:text-foreground",
                insight.eval.signal === signal &&
                  (signal === "up" ? "text-primary" : "text-destructive")
              )}
              type="button"
              onClick={() => void onEval(insight.turnId, signal, note || insight.eval.note)}
            >
              <Icon aria-hidden className="size-3.5" />
            </button>
          );
        })}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              aria-label="Add eval note"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
              type="button"
            >
              <MessageSquare aria-hidden className="size-3.5" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className={cn(glass({ opaque: true }), "z-50 w-64 rounded-xl p-3 shadow-xl")}
              sideOffset={6}
            >
              <textarea
                className="mb-2 h-20 w-full resize-none rounded-md border border-border/60 bg-transparent p-2 text-2xs"
                placeholder="Optional note"
                value={note || insight.eval.note || ""}
                onChange={(event) => setNote(event.target.value)}
              />
              <button
                className="text-2xs text-foreground underline-offset-2 hover:underline"
                type="button"
                onClick={() =>
                  void onEval(insight.turnId, insight.eval.signal ?? "up", note || null)
                }
              >
                Save note
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <div className="ml-auto flex items-center gap-1">
          <button
            aria-label="Previous turn"
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={safeIndex <= 0}
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-2xs tabular-nums text-muted-foreground">
            {insights.length ? safeIndex + 1 : 0}/{insights.length}
          </span>
          <button
            aria-label="Next turn"
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={safeIndex >= insights.length - 1}
            type="button"
            onClick={() => setIndex((value) => Math.min(insights.length - 1, value + 1))}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Jev insight"
        className={cn(
          glass({ opaque: true }),
          "hidden w-64 shrink-0 flex-col rounded-2xl p-3 shadow-lg md:flex",
          "max-h-80",
          className
        )}
      >
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            Insight
          </h2>
          <span className="text-2xs text-muted-foreground">Jev</span>
        </header>
        {body}
      </aside>

      <div className="md:hidden">
        <button
          aria-expanded={sheetOpen}
          className={cn(
            glass({ opaque: true }),
            "fixed bottom-24 right-4 z-30 rounded-full px-3 py-2 text-2xs shadow-lg"
          )}
          type="button"
          onClick={() => setSheetOpen(true)}
        >
          Insight{insights.length ? ` · ${insights.length}` : ""}
        </button>
        {sheetOpen && (
          <div className="fixed inset-0 z-40 flex items-end bg-background/70 p-3" role="dialog">
            <div
              className={cn(
                glass({ opaque: true }),
                "flex max-h-96 w-full flex-col rounded-2xl p-3 shadow-xl"
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
                  Insight
                </h2>
                <button
                  aria-label="Close insight"
                  className="rounded-md p-1 text-muted-foreground"
                  type="button"
                  onClick={() => setSheetOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
              {body}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
