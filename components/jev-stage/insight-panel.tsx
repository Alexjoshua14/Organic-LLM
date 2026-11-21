"use client";

import type { JevStageTraceEvent, JevStageTurnInsight } from "@/lib/jev-stage/schema";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Grip,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { Popover, Tabs } from "radix-ui";

import { InsightContext } from "./insight-context";
import { useInsightPosition } from "./use-insight-position";

import { JEV_GATEWAY_TRACE_MODEL } from "@/lib/jev-stage/constants";
import { glass } from "@/components/design-system/primitives";
import {
  initialInsightPager,
  insightPage,
  insightPagerReducer,
} from "@/lib/jev-stage/insight-pager";
import { summarizeCalls } from "@/lib/jev-stage/trace";
import {
  buildJevTraceView,
  formatTraceMs,
  formatTraceUsd,
  jevTracePath,
  jevTraceTimeline,
  traceForInsight,
  type JevTraceView,
} from "@/lib/jev-stage/trace-view";
import { cn } from "@/lib/utils";

function ConfidenceBars({ trace }: { trace: JevTraceView }) {
  const ranked = trace.decision?.distribution ?? [];
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="space-y-1">
      {top.map((candidate) => (
        <div key={candidate.kind} className="flex items-center gap-2">
          <span className="w-24 truncate text-2xs text-muted-foreground">{candidate.kind}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
            <div
              className={cn(
                "h-full rounded-full bg-foreground/70",
                candidate.kind === trace.action?.action && "bg-primary"
              )}
              style={{ width: `${Math.round(candidate.p * 100)}%` }}
            />
          </div>
          <span className="w-8 text-right text-2xs tabular-nums text-muted-foreground">
            {candidate.p.toFixed(2)}
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
                  <li key={candidate.kind}>
                    <span className="font-medium">{candidate.kind}</span>{" "}
                    <span className="tabular-nums text-muted-foreground">
                      {candidate.p.toFixed(2)}
                    </span>
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

function Glance({
  insight,
}: {
  insight: Pick<JevStageTurnInsight, "calls" | "totals" | "perModelSpendUsd">;
}) {
  const rate = insight.calls.findLast((call) => call.tokensPerSecond != null)?.tokensPerSecond;
  const details = [
    `in ${insight.totals.inputTokens} / out ${insight.totals.outputTokens}`,
    ...Object.entries(insight.perModelSpendUsd).map(
      ([model, spend]) => `${model.split("/").pop()}: ${formatTraceUsd(spend)}`
    ),
    ...(rate != null ? [`${rate} tok/s`] : []),
  ].join(" · ");

  return (
    <div className="grid grid-cols-3 gap-1 text-2xs tabular-nums text-muted-foreground">
      <div>
        <div className="text-foreground/80">{formatTraceUsd(insight.totals.costUsd)}</div>
        <div>total</div>
      </div>
      <div>
        <div className="text-foreground/80">{formatTraceMs(insight.totals.latencyMs)}</div>
        <div>latency</div>
      </div>
      <div>
        <div className="text-foreground/80">{insight.totals.cachedInputTokens}</div>
        <div>cached tok</div>
      </div>
      <p className="col-span-3 truncate" title={details}>
        {details}
      </p>
    </div>
  );
}

export function JevStageInsightPanel({
  insights,
  live,
  onEval,
  className,
}: {
  insights: JevStageTurnInsight[];
  live?: { text: string; status: string; events: JevStageTraceEvent[] };
  onEval: (turnId: string, signal: "up" | "down", note?: string | null) => Promise<void>;
  className?: string;
}) {
  const { panel, offset, handle } = useInsightPosition();
  const [pager, page] = useReducer(insightPagerReducer, undefined, () => initialInsightPager());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("pipeline");
  const count = insights.length + (live ? 1 : 0);
  const safeIndex = insightPage(pager, count);
  const insight = insights[safeIndex] ?? null;
  const note = insight ? (noteDrafts[insight.turnId] ?? "") : "";
  const livePage = !insight && live;
  const trace = useMemo(
    () => buildJevTraceView(insight ? traceForInsight(insight) : (live?.events ?? [])),
    [insight, live?.events]
  );
  const { rows } = jevTraceTimeline(trace);
  const calls = insight?.calls ?? [
    ...(trace.decision
      ? [
          {
            id: "jev",
            operation: "jev.route",
            model: JEV_GATEWAY_TRACE_MODEL,
            inputTokens: trace.decision.inputTokens,
            outputTokens: trace.decision.outputTokens,
            cachedInputTokens: 0,
            costUsd: trace.decision.costUsd,
            latencyMs: trace.decision.ms,
            timeToFirstTokenMs: null,
            tokensPerSecond: null,
          },
        ]
      : []),
    ...trace.hops.flatMap((hop) => (hop.call ? [hop.call] : [])),
  ];
  const usage = {
    ...summarizeCalls(calls),
    ...insight,
    calls,
  };
  const elapsed = trace.done?.t ?? (livePage ? trace.lastT : usage.totals.latencyMs);

  const follow = (
    <button
      aria-pressed={pager.follow}
      className={cn(
        "organic-focus rounded px-1 text-2xs",
        pager.follow ? "text-foreground" : "text-muted-foreground"
      )}
      type="button"
      onClick={() => page({ type: "toggle", count })}
    >
      Follow latest
    </button>
  );

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const body =
    !insight && !livePage ? (
      <p className="text-2xs text-muted-foreground">Send a message to see Jev’s routing insight.</p>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <p className="line-clamp-2 shrink-0 text-2xs leading-snug text-muted-foreground">
          {insight?.userMessage ?? live?.text}
        </p>
        <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <Tabs.List
            aria-label="Turn details"
            className="flex shrink-0 gap-2 border-b border-border/50"
          >
            {["Pipeline", "Context"].map((label) => (
              <Tabs.Trigger
                key={label}
                value={label.toLowerCase()}
                className="organic-focus px-1 pb-1 text-2xs text-muted-foreground data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:underline data-[state=active]:underline-offset-4"
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content
            value="pipeline"
            className="organic-focus min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain py-2"
          >
            {livePage && (
              <p role="status" className="text-2xs text-muted-foreground">
                {live.status}
              </p>
            )}
            <ol aria-label="Route" className="flex flex-wrap gap-x-2 gap-y-1 text-2xs">
              {jevTracePath(trace).map((node, index) => (
                <li
                  key={node.id}
                  className="wrap-anywhere text-muted-foreground"
                  title={node.detail}
                >
                  {index > 0 && <span aria-hidden>→ </span>}
                  <span
                    className={cn(
                      node.status === "active" && "font-medium text-foreground",
                      node.status === "failed" && "text-destructive"
                    )}
                  >
                    {node.label}
                  </span>
                </li>
              ))}
            </ol>
            {trace.decision && (
              <div className="space-y-1">
                <p className="text-2xs text-muted-foreground">
                  {trace.decision.source === "jev" &&
                    trace.decision.floor > 0 &&
                    `Confidence floor ${trace.decision.floor.toFixed(2)}`}
                </p>
                <ConfidenceBars trace={trace} />
              </div>
            )}
            {insight?.outcomeDetail && (
              <p className="text-2xs text-destructive">{insight.outcomeDetail}</p>
            )}
            {insight?.fallbackReason && (
              <p className="text-2xs text-muted-foreground">{insight.fallbackReason}</p>
            )}
            <ol aria-label="Timeline" className="space-y-2 border-t border-border/50 pt-2 text-2xs">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(row.depth === 1 && "ml-2", row.depth === 2 && "ml-4")}
                >
                  <p
                    className={cn(
                      "font-medium wrap-anywhere",
                      row.status === "failed" && "text-destructive"
                    )}
                  >
                    {row.title}
                  </p>
                  {row.detail && (
                    <p className="wrap-anywhere text-muted-foreground">{row.detail}</p>
                  )}
                  <p className="tabular-nums text-muted-foreground">
                    {row.ms != null && formatTraceMs(row.ms)}
                    {row.ms != null && row.costUsd != null && " · "}
                    {row.costUsd != null && formatTraceUsd(row.costUsd)}
                  </p>
                </li>
              ))}
            </ol>
          </Tabs.Content>
          <Tabs.Content
            value="context"
            className="organic-focus min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
          >
            <InsightContext trace={trace} calls={calls} />
          </Tabs.Content>
        </Tabs.Root>
        <div className="shrink-0 border-t border-border/40 pt-2">
          <Glance insight={{ ...usage, totals: { ...usage.totals, latencyMs: elapsed } }} />
        </div>
        <div className="flex shrink-0 items-center gap-1 border-t border-border/40 pt-2">
          {insight && (
            <>
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
                      onChange={(event) => {
                        const value = event.target.value;

                        setNoteDrafts((drafts) => ({ ...drafts, [insight.turnId]: value }));
                      }}
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
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              aria-label="Previous turn"
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={safeIndex <= 0}
              type="button"
              onClick={() => page({ type: "prev", count })}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-2xs tabular-nums text-muted-foreground">
              {count ? safeIndex + 1 : 0}/{count}
            </span>
            <button
              aria-label="Next turn"
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              disabled={safeIndex >= count - 1}
              type="button"
              onClick={() => page({ type: "next", count })}
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
        ref={panel}
        aria-label="Jev insight"
        style={{ translate: `${offset.x}px ${offset.y}px` }}
        className={cn(
          glass({ opaque: true }),
          "pointer-events-auto absolute right-0 top-0 hidden w-64 max-w-full flex-col rounded-2xl p-3 shadow-lg md:flex",
          "h-96 max-h-full",
          className
        )}
      >
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            Insight
          </h2>
          <div className="flex items-center gap-1">
            {follow}
            <button
              {...handle}
              aria-label="Move Insight with arrow keys. Home resets its position."
              className="organic-focus touch-none cursor-grab rounded p-1 text-muted-foreground active:cursor-grabbing"
              type="button"
            >
              <Grip aria-hidden className="size-3.5" />
            </button>
          </div>
        </header>
        {body}
      </aside>

      <div className="md:hidden">
        <button
          aria-expanded={sheetOpen}
          className={cn(
            glass({ opaque: true }),
            "pointer-events-auto fixed bottom-24 right-4 z-30 rounded-full px-3 py-2 text-2xs shadow-lg"
          )}
          type="button"
          onClick={() => setSheetOpen(true)}
        >
          Insight{insights.length ? ` · ${insights.length}` : ""}
        </button>
        {sheetOpen && (
          <div
            aria-modal="true"
            className="pointer-events-auto fixed inset-0 z-40 flex items-end bg-background/70 p-3"
            role="dialog"
          >
            <div
              className={cn(
                glass({ opaque: true }),
                "flex h-96 max-h-full w-full flex-col overflow-hidden rounded-2xl p-3 shadow-xl"
              )}
            >
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <h2 className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
                  Insight
                </h2>
                {follow}
                <button
                  aria-label="Close insight"
                  className="rounded-md p-1 text-muted-foreground"
                  type="button"
                  onClick={() => setSheetOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">{body}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
