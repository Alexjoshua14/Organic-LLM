"use client";

import type {
  ResearchClaimView,
  ResearchReportBlock,
  ResearchSourceSummary,
} from "@/lib/schemas/gen-ui/research-report";

import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, ChevronDown, BookOpen } from "lucide-react";

import { spacing } from "@/lib/design-tokens/spacing";
import {
  RESEARCH_ISSUE_LABELS,
  ResearchSourceSliceSchema,
} from "@/lib/schemas/gen-ui/research-report";
import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";
import { cn } from "@/lib/utils";

/** Hover = muted wash; keyboard focus = inverted fill + underline (no focus rings). */
const controlClass =
  "min-h-11 rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:underline focus-visible:underline-offset-4";
const labelClass = "text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground";
const linkClass =
  "underline underline-offset-2 focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background focus-visible:decoration-2";

function displayDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function CapturedTextReader({
  threadId,
  sourceId,
  page,
}: {
  threadId: string;
  sourceId: string;
  page?: number;
}) {
  const [text, setText] = useState("");
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ offset: String(offset), limit: "12000" });

    if (page !== undefined) query.set("page", String(page));
    setLoading(true);
    setError("");
    fetch(
      `/api/chat/${encodeURIComponent(threadId)}/research/sources/${encodeURIComponent(sourceId)}?${query}`,
      { signal: controller.signal, cache: "no-store" }
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Could not load this saved source. Try again or open the original.");
        const slice = ResearchSourceSliceSchema.parse(await response.json());

        if (controller.signal.aborted) return;
        setText((previous) =>
          offset === 0 ? slice.untrustedText : previous + slice.untrustedText
        );
        setNextOffset(slice.nextOffset);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Could not load this saved source. Try again or open the original.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [threadId, sourceId, page, offset, attempt]);

  return (
    <div className="space-y-stack-sm" aria-busy={loading}>
      {text ? (
        <textarea
          className="max-h-96 w-full resize-y overflow-y-auto overscroll-contain rounded-lg border border-border/40 bg-background/40 p-inset-md font-sans text-sm leading-relaxed text-foreground/85 focus-visible:outline-none focus-visible:bg-muted focus-visible:text-foreground focus-visible:border-foreground"
          readOnly
          rows={12}
          value={text}
          aria-label="Captured source text"
        />
      ) : null}
      {loading ? (
        <p role="status" className="text-xs text-muted-foreground">
          Reading saved text…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-muted-foreground">
          {error}
        </p>
      ) : null}
      {error ? (
        <button
          type="button"
          className={controlClass}
          onClick={() => setAttempt((previous) => previous + 1)}
        >
          Try again
        </button>
      ) : null}
      {!loading && !error && nextOffset !== null ? (
        <button type="button" className={controlClass} onClick={() => setOffset(nextOffset)}>
          Read more captured text
        </button>
      ) : null}
      {!loading && !error && !text ? (
        <p className="text-xs text-muted-foreground">No readable text was captured.</p>
      ) : null}
    </div>
  );
}

export function ResearchSourceCard({
  source,
  threadId,
  index,
  inspection = 0,
}: {
  source: ResearchSourceSummary;
  threadId?: string;
  index: number;
  inspection?: number;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!inspection || !detailsRef.current) return;
    detailsRef.current.open = true;
    detailsRef.current.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }, [inspection]);

  const [readText, setReadText] = useState(false);
  const [page, setPage] = useState("");
  const scope = source.excerptOnly
    ? "Search excerpt"
    : source.truncated
      ? "Partial capture"
      : "Captured page";
  const hostname = new URL(source.url).hostname.replace(/^www\./, "");

  return (
    <details
      ref={detailsRef}
      className="group/source min-w-0 border-b border-border/40 last:border-b-0"
    >
      <summary
        className={cn(
          controlClass,
          "flex cursor-pointer list-none items-start gap-inline-sm rounded-none px-0 py-inset-sm"
        )}
      >
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/50 font-mono text-2xs text-muted-foreground group-open/source:border-foreground/40 group-open/source:text-foreground">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-medium leading-snug">
            {source.title || hostname}
          </span>
          <span className="mt-stack-xs flex flex-wrap items-center gap-x-inline-sm gap-y-stack-xs text-2xs font-normal text-muted-foreground">
            <span>{hostname}</span>
            <span>{scope}</span>
          </span>
        </span>
        <ChevronDown
          className="mt-1 size-4 shrink-0 text-muted-foreground group-open/source:rotate-180"
          aria-hidden
        />
      </summary>
      <div className={cn("pb-inset-md", spacing.card.section)}>
        {source.synopsis ? (
          <p className="text-sm leading-relaxed text-foreground/80">{source.synopsis}</p>
        ) : null}
        {source.takeaways.length ? (
          <div className={spacing.card.labelStack}>
            <p className={labelClass}>Lyra’s takeaways</p>
            <ul className="list-disc space-y-stack-sm pl-4 text-sm leading-relaxed text-foreground/90">
              {source.takeaways.map((takeaway, i) => (
                <li key={i}>{takeaway}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={spacing.card.labelStack}>
          <p className={labelClass}>Captured excerpt</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {source.preview || "No preview available."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-inline-sm gap-y-stack-sm text-2xs text-muted-foreground">
          <span>
            {source.provider === "exa"
              ? "Exa"
              : source.provider === "docling"
                ? "Docling"
                : "Firecrawl"}
          </span>
          <span>Captured {displayDate(source.fetchedAt)}</span>
          {source.publishedAt ? <span>Published {displayDate(source.publishedAt)}</span> : null}
          <span>{new Intl.NumberFormat().format(source.capturedChars)} characters</span>
        </div>
        <div className="flex flex-wrap items-center gap-inline-sm">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              controlClass,
              "inline-flex items-center gap-inline-sm border border-border/50"
            )}
          >
            Open original <ExternalLink className="size-3" aria-hidden />
          </a>
          {threadId ? (
            <button
              type="button"
              className={cn(controlClass, "inline-flex items-center gap-inline-sm")}
              onClick={() => setReadText((previous) => !previous)}
              aria-expanded={readText}
            >
              <BookOpen className="size-3" aria-hidden />
              {readText ? "Close captured text" : "Read captured text"}
            </button>
          ) : null}
        </div>
        {readText && threadId ? (
          <div className={spacing.card.block}>
            {source.pages.length ? (
              <label className="flex flex-wrap items-center gap-inline-sm text-xs text-muted-foreground">
                Document page
                <select
                  value={page}
                  onChange={(event) => setPage(event.target.value)}
                  className={cn(controlClass, "border border-border/50 bg-background")}
                >
                  <option value="">All captured text</option>
                  {source.pages.map((number) => (
                    <option key={number} value={String(number)}>
                      Page {number}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <CapturedTextReader
              key={page}
              threadId={threadId}
              sourceId={source.id}
              page={page ? Number(page) : undefined}
            />
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {source.excerptOnly
                ? "This snapshot contains search excerpts. It is not a full article."
                : source.truncated
                  ? "This capture is partial. Open the original to inspect the complete source."
                  : "This is the text captured during research; the original page may have changed."}
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function ResearchClaimCard({
  claim,
  sourceNumbers,
  onInspectSource,
}: {
  claim: ResearchClaimView;
  sourceNumbers?: Map<string, number>;
  onInspectSource?: (sourceId: string) => void;
}) {
  const titleId = useId();
  const sourceIds = [...new Set(claim.evidence.map((evidence) => evidence.sourceId))];

  return (
    <article
      aria-labelledby={titleId}
      className={cn("min-w-0 py-inset-md", spacing.card.blockItems)}
    >
      <div className={spacing.card.labelStack}>
        <h4 id={titleId} className="text-sm font-medium leading-snug text-foreground">
          <GenUIMarkdown inline>{claim.statement}</GenUIMarkdown>
        </h4>
        {claim.assessment ? (
          <GenUIMarkdown className="space-y-stack-xs text-sm leading-relaxed text-foreground/80">
            {claim.assessment}
          </GenUIMarkdown>
        ) : null}
      </div>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        {claim.issues.length
          ? claim.issues.map((issue) => RESEARCH_ISSUE_LABELS[issue]).join(" · ")
          : claim.evidence.length
            ? "Quotes match captured sources"
            : "No evidence has been attached to this claim."}
      </p>

      {claim.evidence.length ? (
        <details className="group/claim">
          <summary
            className={cn(
              controlClass,
              "flex w-fit cursor-pointer list-none items-center gap-inline-sm px-0"
            )}
          >
            <BookOpen className="size-3.5 shrink-0" aria-hidden />
            Inspect evidence · {claim.evidence.length}
            <ChevronDown className="size-3.5 group-open/claim:rotate-180" aria-hidden />
          </summary>
          <div className={cn("border-t border-border/30 pt-inset-sm", spacing.card.blockItems)}>
            {claim.evidence.map((evidence, index) => (
              <figure key={`${evidence.sourceId}-${index}`} className={spacing.card.labelStack}>
                <figcaption className="flex flex-wrap items-center gap-inline-sm text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "font-medium capitalize",
                      evidence.relation === "contradicts" && "text-amber-700 dark:text-amber-300"
                    )}
                  >
                    {evidence.relation}
                  </span>
                  {evidence.url ? (
                    <a
                      href={evidence.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {evidence.title || evidence.sourceId}
                    </a>
                  ) : (
                    <span>{evidence.title || evidence.sourceId}</span>
                  )}
                  {evidence.page ? <span>Page {evidence.page}</span> : null}
                </figcaption>
                <blockquote className="whitespace-pre-wrap break-words border-l border-border pl-inset-md text-sm leading-relaxed text-foreground/85">
                  {evidence.quote}
                  {evidence.quoteTruncated ? "…" : ""}
                </blockquote>
              </figure>
            ))}
          </div>
        </details>
      ) : null}

      {onInspectSource && sourceIds.length ? (
        <div className="flex flex-wrap items-center gap-inline-sm" aria-label="Finding sources">
          {sourceIds.map((sourceId) => {
            const number = sourceNumbers?.get(sourceId);

            return number ? (
              <button
                key={sourceId}
                type="button"
                className={cn(controlClass, "border border-border/50")}
                onClick={() => onInspectSource(sourceId)}
              >
                Inspect source {number}
              </button>
            ) : (
              <span key={sourceId} className="text-xs text-muted-foreground">
                Source unavailable · {sourceId}
              </span>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

export function ResearchReport({
  block,
  partial,
}: {
  block: ResearchReportBlock;
  partial?: boolean;
}) {
  const [inspections, setInspections] = useState<Record<string, number>>({});
  const sourcesLibraryRef = useRef<HTMLDetailsElement>(null);
  const sourceNumbers = new Map(block.sources.map((source, index) => [source.id, index + 1]));

  const inspectSource = (sourceId: string) => {
    if (sourcesLibraryRef.current) sourcesLibraryRef.current.open = true;
    setInspections((previous) => ({
      ...previous,
      [sourceId]: (previous[sourceId] ?? 0) + 1,
    }));
  };

  return (
    <section
      className={cn("min-w-0 text-foreground", spacing.card.section)}
      aria-label={block.title}
    >
      <header className={spacing.card.labelStack}>
        <p className={labelClass}>Lyra · Research</p>
        <h3 className="text-lg font-semibold leading-snug tracking-tight">{block.title}</h3>
        <GenUIMarkdown className="space-y-stack-sm text-sm leading-relaxed text-foreground/85">
          {block.summary}
        </GenUIMarkdown>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          {block.claims.length} {block.claims.length === 1 ? "finding" : "findings"} ·{" "}
          {block.sources.length} {block.sources.length === 1 ? "source" : "sources"}
          {partial ? " · Report arriving" : ""}
        </p>
      </header>

      <section aria-label="Findings and evidence" className="border-t border-border/40 pt-inset-sm">
        <h4 className={labelClass}>Findings</h4>
        {block.claims.length ? (
          <div className="divide-y divide-border/30">
            {block.claims.map((claim) => (
              <ResearchClaimCard
                key={claim.id}
                claim={claim}
                sourceNumbers={sourceNumbers}
                onInspectSource={inspectSource}
              />
            ))}
          </div>
        ) : (
          <p className="pt-inset-sm text-sm leading-relaxed text-muted-foreground">
            {partial
              ? "Findings are still arriving."
              : "No findings have been recorded for this report. The source notes below remain available to inspect."}
          </p>
        )}
      </section>

      {block.limitations.length ? (
        <details className="group/limits border-t border-border/40 pt-inset-sm">
          <summary
            className={cn(
              controlClass,
              "flex w-full cursor-pointer list-none items-center justify-between gap-inline-sm rounded-none px-0"
            )}
          >
            <span className={labelClass}>
              Limitations & open questions · {block.limitations.length}
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground group-open/limits:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="list-disc space-y-stack-sm pb-inset-sm pl-inset-lg pt-inset-sm text-sm leading-relaxed text-muted-foreground">
            {block.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <details
        ref={sourcesLibraryRef}
        className="group/sources border-t border-border/40 pt-inset-sm"
      >
        <summary
          className={cn(
            controlClass,
            "flex w-full cursor-pointer list-none items-center justify-between gap-inline-sm rounded-none px-0"
          )}
        >
          <span className={labelClass}>Sources · {block.sources.length}</span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground group-open/sources:rotate-180"
            aria-hidden
          />
        </summary>
        <div className={cn("pb-inset-sm pt-inset-sm", spacing.card.blockItems)}>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Inspect the captured material behind the findings. Synopses and takeaways are Lyra’s
            interpretation.
          </p>
          {block.sources.map((source, index) => (
            <ResearchSourceCard
              key={source.id}
              source={source}
              threadId={block.threadId}
              index={index}
              inspection={inspections[source.id]}
            />
          ))}
          {!block.sources.length ? (
            <p className="text-sm text-muted-foreground">
              {partial ? "Sources are still arriving." : "No captured sources are available."}
            </p>
          ) : null}
        </div>
      </details>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Matching quotations establish traceability, not truth or source independence. Assess the
        source and its methods yourself.
      </p>
    </section>
  );
}
