"use client";

import Link from "next/link";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Fragment, useCallback, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, Info, Loader2 } from "lucide-react";

import Page from "@/components/layout/page";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/third-party/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  MEMORY_LEGACY_EMBEDDING_DIMS,
  MEMORY_LEGACY_EMBEDDER_MODEL,
  MEMORY_LEGACY_QDRANT_COLLECTION,
} from "@/config/memory-legacy-meta";
import {
  MEMORY_PRODUCTION_EMBEDDING_DIMS,
  MEMORY_PRODUCTION_EMBEDDER_MODEL,
  MEMORY_PRODUCTION_QDRANT_COLLECTION,
} from "@/config/memory-production-meta";
import type {
  LegacyMarginalInfo,
  MemoryMigrationTestResponse,
  MigrationCompareEnrichedRow,
  V2MarginalInfo,
} from "@/lib/memory/memory-migration-test-types";
import type { MemoryItemType } from "@/lib/schemas/memory";

/** Aligned with `scripts/migrate-memories-v2.ts` defaults for sandbox comparison copy. */
const MEMORY_V2_COLLECTION = "memories_v2";
const MEMORY_V2_EMBEDDER_MODEL = "nomic-embed-text";
const MEMORY_V2_EMBEDDING_DIMS = 768;

const tooltipContentClass = cn(
  "z-50 max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-2 text-xs font-normal normal-case leading-snug text-balance",
  "bg-primary text-primary-foreground shadow-md",
  "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  "motion-reduce:animate-none",
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
);

const READING_TIPS_TOOLTIP = [
  "Cosine scores rank hits within each column only. Do not compare raw numbers across Legacy vs v2—different embedders and dimensions mean the scales are not comparable.",
  "When a side shows “present but below returned top-K,” Δ is how far the best off-list score sits below the weakest hit that was returned for that column—lower means less relevant to this query, not missing data.",
].join(" ");

const DELTA_METRICS_TOOLTIP =
  "Positive Δ is how far the best off-list score sits below the weakest hit returned in that column for this query—lower means less relevant to the query, not missing data.";

type SpecCell = { text: string; tooltip: string };

type SpecRowDef = {
  label: string;
  labelTooltip?: string;
  production: SpecCell;
  candidate: SpecCell;
};

const SPEC_ROWS: SpecRowDef[] = [
  {
    label: "Qdrant collection",
    labelTooltip: "Named Qdrant collection each side queries for this sandbox run.",
    production: {
      text: MEMORY_LEGACY_QDRANT_COLLECTION,
      tooltip:
        "Pre-cutover Mem0 collection (one vector per memory). This sandbox still queries it directly for A/B; live Mem0 uses memories_v2 after cutover.",
    },
    candidate: {
      text: MEMORY_V2_COLLECTION,
      tooltip:
        "Chunked collection (many points per logical memory). This column uses the sandbox chunk-aggregate search, not necessarily the same code path as Mem0 search on the same collection.",
    },
  },
  {
    label: "Memory text at rest",
    labelTooltip:
      "Whether raw memory wording is readable from Qdrant payloads if someone obtains a database snapshot.",
    production: {
      text: "Typically readable",
      tooltip:
        "Legacy Mem0 points usually store memory text in payload fields readable from a DB snapshot unless you encrypt separately at the host layer.",
    },
    candidate: {
      text: "AES-GCM on chunks (when configured)",
      tooltip:
        "With MEMORY_ENCRYPTION_* set, chunk text is AES-GCM encrypted before upsert. At-rest snapshots do not reveal memory wording without your key material.",
    },
  },
  {
    label: "Ollama embedder",
    labelTooltip:
      "Model and vector width define the embedding space. Similarity scores are only meaningful within one side—never compare raw numbers across columns.",
    production: {
      text: `${MEMORY_LEGACY_EMBEDDER_MODEL} (${MEMORY_LEGACY_EMBEDDING_DIMS}-D)`,
      tooltip:
        "Legacy side embeds queries with all-minilm (384-D) to match vectors stored in the old collection.",
    },
    candidate: {
      text: `${MEMORY_V2_EMBEDDER_MODEL} (${MEMORY_V2_EMBEDDING_DIMS}-D)`,
      tooltip:
        "v2 side uses nomic-embed-text (768-D). Scores use a different scale than the legacy column; rank hits within each column only.",
    },
  },
  {
    label: "Long-form content",
    labelTooltip:
      "How very long notes are represented for search. Chunking keeps more verbatim text addressable by embeddings.",
    production: {
      text: "One point per memory",
      tooltip:
        "A single vector must summarize the entire memory string. Very long notes get compressed into one embedding, which dilutes detail and caps how much wording retrieval can target precisely.",
    },
    candidate: {
      text: "Many chunks per memory",
      tooltip:
        "Long text is split into chunks, each embedded separately. You retain far more total characters across points, and search returns the slice whose vector best matches the query instead of one average over the whole note.",
    },
  },
];

function HintCell({
  tip,
  className,
  children,
  ariaLabel = "Explain this value",
  align = "start",
}: {
  tip: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  align?: "start" | "center";
}) {
  const [open, setOpen] = useState(false);
  const iconBtn = (
    <Tooltip.Trigger asChild>
      <button
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "shrink-0 rounded-sm p-0.5 text-primary/80 outline-none transition-opacity duration-150",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
        )}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
    </Tooltip.Trigger>
  );
  return (
    <Tooltip.Root
      open={open}
      onOpenChange={(next) => {
        if (next === false) setOpen(false);
      }}
      delayDuration={0}
    >
      {align === "center" ? (
        <div className={cn("group flex w-full justify-center", className)}>
          <div className="flex max-w-full items-center gap-1">
            <div className="min-w-0 text-center">{children}</div>
            {iconBtn}
          </div>
        </div>
      ) : (
        <div className={cn("group flex w-full min-w-0 items-center gap-1", className)}>
          <div className="min-w-0 flex-1 overflow-hidden text-left">{children}</div>
          {iconBtn}
        </div>
      )}
      <Tooltip.Portal>
        <Tooltip.Content
          className={tooltipContentClass}
          sideOffset={6}
          side="top"
          onPointerDownOutside={() => setOpen(false)}
          onEscapeKeyDown={() => setOpen(false)}
        >
          {tip}
          <Tooltip.Arrow className="fill-primary" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function MemoryCell({
  memory,
  label,
  side,
}: {
  memory: MemoryItemType;
  label?: string;
  side?: "legacy" | "v2";
}) {
  const rail =
    side === "legacy"
      ? "border-l-2 border-muted-foreground/25"
      : side === "v2"
        ? "border-l-2 border-primary/30"
        : "";

  const header =
    side === "legacy" ? (
      <>
        <span className="text-foreground/80">Legacy</span>
        {label ? <span className="font-normal text-muted-foreground"> · {label}</span> : null}
      </>
    ) : side === "v2" ? (
      <>
        <span className="text-foreground/80">v2</span>
        {label ? <span className="font-normal text-muted-foreground"> · {label}</span> : null}
      </>
    ) : label ? (
      label
    ) : null;

  return (
    <article className={cn("space-y-2 pl-3", rail)}>
      {header ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{header}</p>
      ) : null}
      {typeof memory.score === "number" ? (
        <span className="block text-[10px] tabular-nums text-muted-foreground">score {memory.score.toFixed(4)}</span>
      ) : null}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{memory.memory}</p>
    </article>
  );
}

function V2MarginalCallout({
  info,
  className,
  flush,
}: {
  info: V2MarginalInfo;
  className?: string;
  /** Omit left rail when nested inside `SplitColumnMarginalOnlyShell` (shell already has the rail). */
  flush?: boolean;
}) {
  const metricsPlain = (
    <>
      best {info.bestChunkScore.toFixed(4)}
      {info.lowestReturnedV2Score != null ? (
        <> · weakest {info.lowestReturnedV2Score.toFixed(4)}</>
      ) : (
        <> · no v2 hits returned</>
      )}
      {info.deltaVsLowestReturned != null ? (
        <>
          {" · "}
          <span className="text-primary/85">Δ {info.deltaVsLowestReturned.toFixed(4)}</span>
        </>
      ) : null}
    </>
  );
  const inner = (
    <>
      <p className="text-left text-[13px] italic leading-snug text-foreground/70">
        Present in v2 but below returned top-K relevant memories
      </p>
      {info.deltaVsLowestReturned != null ? (
        <HintCell
          tip={DELTA_METRICS_TOOLTIP}
          ariaLabel="Explain delta metrics"
          align="start"
          className="mt-1 max-w-full"
        >
          <span className="text-[8px] font-normal tabular-nums text-muted-foreground">{metricsPlain}</span>
        </HintCell>
      ) : (
        <p className="mt-1 text-left text-[8px] font-normal tabular-nums text-muted-foreground">{metricsPlain}</p>
      )}
    </>
  );
  return (
    <div
      className={cn(
        "w-full text-muted-foreground",
        flush
          ? "mt-1 border-0 pl-0"
          : "mt-3 border-l-2 border-primary/30 pl-2",
        className
      )}
    >
      {inner}
    </div>
  );
}

function LegacyMarginalCallout({
  info,
  className,
  flush,
}: {
  info: LegacyMarginalInfo;
  className?: string;
  flush?: boolean;
}) {
  const metricsPlain = (
    <>
      best {info.bestLegacyScore.toFixed(4)}
      {info.lowestReturnedLegacyScore != null ? (
        <> · weakest {info.lowestReturnedLegacyScore.toFixed(4)}</>
      ) : (
        <> · no legacy hits returned</>
      )}
      {info.deltaVsLowestReturned != null ? (
        <>
          {" · "}
          <span className="text-primary/85">Δ {info.deltaVsLowestReturned.toFixed(4)}</span>
        </>
      ) : null}
    </>
  );
  const inner = (
    <>
      <p className="text-left text-[13px] italic leading-snug text-foreground/70">
        Present in Legacy but below returned top-K relevant memories
      </p>
      {info.deltaVsLowestReturned != null ? (
        <HintCell
          tip={DELTA_METRICS_TOOLTIP}
          ariaLabel="Explain delta metrics"
          align="start"
          className="mt-1 max-w-full"
        >
          <span className="text-[8px] font-normal tabular-nums text-muted-foreground">{metricsPlain}</span>
        </HintCell>
      ) : (
        <p className="mt-1 text-left text-[8px] font-normal tabular-nums text-muted-foreground">{metricsPlain}</p>
      )}
    </>
  );
  return (
    <div
      className={cn(
        "w-full text-muted-foreground",
        flush
          ? "mt-1 border-0 pl-0"
          : "mt-3 border-l-2 border-muted-foreground/25 pl-2",
        className
      )}
    >
      {inner}
    </div>
  );
}

function splitColumnShellClass(side: "legacy" | "v2") {
  return cn(
    "space-y-1 pl-3 text-[11px] leading-snug text-muted-foreground",
    side === "legacy" ? "border-l-2 border-muted-foreground/25" : "border-l-2 border-primary/30"
  );
}

function SplitColumnMarginalOnlyShell({
  side,
  children,
}: {
  side: "legacy" | "v2";
  children: ReactNode;
}) {
  return (
    <div className={splitColumnShellClass(side)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {side === "legacy" ? "Legacy" : "v2"}
      </p>
      {children}
    </div>
  );
}

function EmptyCell({ side }: { side: "legacy" | "v2" }) {
  return (
    <div className={splitColumnShellClass(side)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {side === "legacy" ? "Legacy" : "v2"}
      </p>
      <p>
        No hit in{" "}
        <span className="font-mono text-[10px] text-foreground/80">
          {side === "legacy" ? MEMORY_LEGACY_QDRANT_COLLECTION : MEMORY_V2_COLLECTION}
        </span>
      </p>
    </div>
  );
}

function CompareGrid({ rows }: { rows: MigrationCompareEnrichedRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      {rows.map((row, i) => {
        if (row.kind === "merged") {
          return (
            <div
              key={`merged-${i}-${row.memory.id}`}
              className="my-1 rounded-md border-l-2 border-primary/40 bg-muted/15 py-3 pl-4 pr-3 ring-1 ring-primary/10"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Both sides</p>
              <MemoryCell memory={row.memory} />
            </div>
          );
        }
        return (
          <div
            key={`split-${i}-${row.legacy?.id ?? ""}-${row.v2?.id ?? ""}`}
            className="rounded-lg border border-border/60 bg-muted/[0.02] p-4"
          >
            <div className="grid grid-cols-1 gap-6 border-border/50 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-border/50">
              <div className="min-w-0 rounded-md bg-muted/25 sm:pr-5 sm:py-1 sm:pl-1">
                {row.legacy ? (
                  <MemoryCell
                    memory={row.legacy}
                    label={MEMORY_LEGACY_QDRANT_COLLECTION}
                    side="legacy"
                  />
                ) : row.legacyMarginal ? (
                  <SplitColumnMarginalOnlyShell side="legacy">
                    <LegacyMarginalCallout flush info={row.legacyMarginal} />
                  </SplitColumnMarginalOnlyShell>
                ) : (
                  <EmptyCell side="legacy" />
                )}
              </div>
              <div className="min-w-0 rounded-md border-t border-border/50 bg-primary/[0.04] pt-6 sm:border-t-0 sm:py-1 sm:pl-5 sm:pt-0">
                {row.v2 ? (
                  <MemoryCell memory={row.v2} label={MEMORY_V2_COLLECTION} side="v2" />
                ) : row.v2Marginal ? (
                  <SplitColumnMarginalOnlyShell side="v2">
                    <V2MarginalCallout flush info={row.v2Marginal} />
                  </SplitColumnMarginalOnlyShell>
                ) : (
                  <EmptyCell side="v2" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MemoryMigrationTestsPage() {
  const [loading, setLoading] = useState(false);
  const [pendingQueryCount, setPendingQueryCount] = useState<5 | 10 | 20 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MemoryMigrationTestResponse | null>(null);

  const run = useCallback(async (queryCount: 5 | 10 | 20) => {
    setPendingQueryCount(queryCount);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/sandbox/memory-migration-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryCount }),
      });
      const json = (await res.json()) as Partial<MemoryMigrationTestResponse> & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        if (Array.isArray(json.runs)) {
          setData({
            runs: json.runs,
            synopsis: json.synopsis ?? null,
            synopsisError: json.synopsisError,
            synopsisSkippedReason: json.synopsisSkippedReason ?? null,
          });
        }
        return;
      }
      setData({
        runs: json.runs ?? [],
        synopsis: json.synopsis ?? null,
        synopsisError: json.synopsisError,
        synopsisSkippedReason: json.synopsisSkippedReason ?? null,
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
      setPendingQueryCount(null);
    }
  }, []);

  return (
    <Page>
      <Tooltip.Provider delayDuration={250} skipDelayDuration={0}>
      <div className="mx-auto w-full max-w-5xl px-5 py-5 pb-14">
        <Link
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground mb-4"
          href="/sandbox"
        >
          <ArrowLeft className="size-4" />
          Sandbox
        </Link>

        <section
          className={cn(
            "rounded-xl border border-border/70 bg-gradient-to-b from-muted/20 to-background",
            "p-3 shadow-sm md:p-4 mb-4"
          )}
        >
          <h1 className="text-xl font-semibold tracking-tight text-foreground mb-1">
            Memory retrieval comparison
          </h1>
          <p className="text-xs text-muted-foreground leading-snug mb-2 max-w-2xl">
            Paired searches: same query against legacy{" "}
            <span className="font-mono text-[11px] text-foreground/85">{MEMORY_LEGACY_QDRANT_COLLECTION}</span> and
            chunked <span className="font-mono text-[11px] text-foreground/85">{MEMORY_V2_COLLECTION}</span>. Live Mem0
            uses <span className="font-mono text-[11px] text-foreground/85">{MEMORY_PRODUCTION_QDRANT_COLLECTION}</span>{" "}
            ({MEMORY_PRODUCTION_EMBEDDER_MODEL}, {MEMORY_PRODUCTION_EMBEDDING_DIMS}-D). Cosine scores rank within a
            column only. Hover or focus a cell and use the info icon for details.
          </p>

          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Legacy vs v2
            </span>
            <HintCell
              tip={READING_TIPS_TOOLTIP}
              ariaLabel="Reading tips"
              className="-mx-0.5 rounded-sm px-1 py-0.5 hover:bg-muted/40"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-primary/90 underline decoration-primary/30 underline-offset-2">
                Reading tips
              </span>
            </HintCell>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/50 bg-background/50 mb-2">
            <div className="min-w-[min(100%,520px)] grid grid-cols-1 md:grid-cols-[minmax(6.5rem,8.5rem)_1fr_1fr] text-xs">
              <div className="hidden md:contents">
                <div className="border-b border-border/50 bg-muted/25 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Setting
                </div>
                <div className="border-b border-l border-border/50 bg-muted/25 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Legacy {MEMORY_LEGACY_QDRANT_COLLECTION}
                </div>
                <div className="border-b border-l border-primary/25 bg-primary/[0.06] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Candidate {MEMORY_V2_COLLECTION}
                </div>
              </div>
              {SPEC_ROWS.map((row) => (
                <Fragment key={row.label}>
                  <div className="border-b border-border/40 px-2.5 py-1.5 text-foreground md:border-r-0">
                    <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground md:hidden">
                      Setting
                    </span>
                    <HintCell tip={row.labelTooltip ?? ""} className="-mx-1 px-1 py-0.5" ariaLabel="Explain this setting">
                      <div className="font-medium text-foreground">{row.label}</div>
                    </HintCell>
                  </div>
                  <div className="border-b border-border/40 bg-muted/10 px-2.5 py-1.5 text-foreground/90 md:border-l md:border-border/50">
                    <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground md:hidden">
                      Legacy
                    </span>
                    <HintCell tip={row.production.tooltip} className="-mx-1 px-1 py-0.5" ariaLabel="Explain legacy value">
                      <div>{row.production.text}</div>
                    </HintCell>
                  </div>
                  <div className="border-b border-border/40 bg-primary/[0.04] px-2.5 py-1.5 text-foreground/90 md:border-l-2 md:border-primary/25">
                    <span className="mb-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground md:hidden">
                      Candidate
                    </span>
                    <HintCell tip={row.candidate.tooltip} className="-mx-1 px-1 py-0.5" ariaLabel="Explain candidate value">
                      <div>{row.candidate.text}</div>
                    </HintCell>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          <p className="text-[10px] leading-snug text-muted-foreground mb-2">
            Live Mem0:{" "}
            <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[10px]">config/memory-production-meta.ts</code>
            {" · "}
            <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[10px]">config/mem0-config.ts</code>
            {" · "}Legacy sandbox constants:{" "}
            <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[10px]">config/memory-legacy-meta.ts</code>
          </p>

          <Collapsible
            defaultOpen={false}
            className="group mb-3 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2"
          >
            <CollapsibleTrigger
              className={cn(
                "flex w-full cursor-pointer list-none items-center justify-between gap-2 text-left text-xs font-medium text-foreground outline-none",
                "rounded-sm transition-opacity duration-150 hover:opacity-90",
                "focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <span>Runtime / migration notes</span>
              <span className="inline text-[10px] text-muted-foreground group-data-[state=open]:hidden">Show</span>
              <span className="hidden text-[10px] text-muted-foreground group-data-[state=open]:inline">Hide</span>
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                "overflow-hidden",
                "data-[state=closed]:animate-out data-[state=open]:animate-in",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2",
                "data-[state=closed]:duration-150 data-[state=open]:duration-200",
                "motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
              )}
            >
              <div className="mt-2 space-y-2 border-t border-border/50 pt-2 text-xs leading-relaxed text-muted-foreground">
                <p>
                  Live Mem0 reads/writes <span className="font-mono text-[11px] text-foreground/85">{MEMORY_PRODUCTION_QDRANT_COLLECTION}</span>{" "}
                  with <span className="font-mono text-[11px]">{MEMORY_PRODUCTION_EMBEDDER_MODEL}</span> (
                  {MEMORY_PRODUCTION_EMBEDDING_DIMS}-D). The left sandbox column still queries legacy{" "}
                  <span className="font-mono text-[11px]">{MEMORY_LEGACY_QDRANT_COLLECTION}</span> using{" "}
                  <span className="font-mono text-[11px]">{MEMORY_LEGACY_EMBEDDER_MODEL}</span> for embeddings.
                </p>
                <p>
                  <span className="font-mono text-[11px]">{MEMORY_V2_COLLECTION}</span> supports optional AES-GCM on
                  chunks via{" "}
                  <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[10px]">MEMORY_ENCRYPTION_*</code>. Fill
                  it with{" "}
                  <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[10px]">scripts/migrate-memories-v2.ts</code>;
                  the migrator quality-filters weak writes.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Run paired searches
            </span>
            {loading ? (
              <div
                role="status"
                aria-busy="true"
                aria-live="polite"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/60 bg-muted/25 px-4 py-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                <span>
                  {pendingQueryCount != null
                    ? `Running ${pendingQueryCount} queries…`
                    : "Running queries…"}
                </span>
              </div>
            ) : (
              ([5, 10, 20] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => run(n)}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                    "bg-foreground text-background transition-colors duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100"
                  )}
                >
                  {n} queries
                </button>
              ))
            )}
          </div>

          {!loading && !data && !error ? (
            <ul className="mt-2 text-[12px] text-muted-foreground space-y-0.5 list-disc pl-4 max-w-xl">
              <li>
                Queries are sampled from your stored memories when possible, then padded with fixed
                probe phrases so every run hits the full count.
              </li>
              <li>Results below show legacy hits beside v2 chunk hits for the same query.</li>
            </ul>
          ) : null}
        </section>

        {error ? (
          <div
            className="mb-5 rounded-lg border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {data ? (
          <div
            className={cn(
              "mb-8 space-y-5",
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
              "motion-reduce:animate-none"
            )}
          >
            {data.synopsis ? (
              <section className="max-w-prose border-t border-border/60 pt-4">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Synopsis (LLM)
                </h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {data.synopsis}
                </p>
              </section>
            ) : null}
            {data.synopsisSkippedReason ? (
              <p className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
                Synopsis skipped: {data.synopsisSkippedReason}
              </p>
            ) : null}
            {data.synopsisError ? (
              <p className="border-t border-border/60 pt-4 text-sm text-destructive" role="status">
                Synopsis unavailable: {data.synopsisError}
              </p>
            ) : null}

            {data.runs?.length ? (
              <>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">Rows</span>
                  {" · "}
                  Legacy (left), <span className="font-mono text-[10px]">{MEMORY_V2_COLLECTION}</span> (right).
                  Merged matches use the &quot;Both sides&quot; band; split pairs sit in bordered rows.
                </p>
                <div className="space-y-8 border-t border-border/50 pt-5">
                  {data.runs.map((run, runIdx) => (
                    <section key={`${run.query}-${runIdx}`} className="scroll-mt-4">
                      <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Query{" "}
                        <span className="tabular-nums text-muted-foreground/90">
                          {runIdx + 1} / {data.runs.length}
                        </span>
                      </h3>
                      <p className="mb-4 max-w-prose border-l-2 border-foreground/15 pl-3 text-base font-medium leading-snug text-foreground whitespace-pre-wrap">
                        {run.query}
                      </p>
                      {run.v2Error ? (
                        <div
                          className="mb-4 flex items-start gap-2 border-l-2 border-destructive/35 pl-3 py-1 text-sm text-destructive"
                          role="status"
                        >
                          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>
                            <span className="font-mono text-xs">{MEMORY_V2_COLLECTION}</span>: {run.v2Error}
                          </span>
                        </div>
                      ) : null}
                      <CompareGrid rows={run.rows} />
                    </section>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      </Tooltip.Provider>
    </Page>
  );
}
