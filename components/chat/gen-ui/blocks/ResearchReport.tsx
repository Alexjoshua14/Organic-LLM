"use client";

import type {
  ResearchClaimView,
  ResearchReportBlock,
  ResearchSourceSummary,
} from "@/lib/schemas/gen-ui/research-report";

import { useEffect, useState } from "react";
import { ExternalLink, ChevronDown, BookOpen } from "lucide-react";

import { spacing } from "@/lib/design-tokens/spacing";
import {
  RESEARCH_ISSUE_LABELS,
  ResearchSourceSliceSchema,
} from "@/lib/schemas/gen-ui/research-report";
import { cn } from "@/lib/utils";

const controlClass =
  "min-h-11 rounded-lg px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const labelClass = "text-2xs font-semibold uppercase tracking-[0.1em] text-muted-foreground";

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
          className="max-h-96 w-full resize-y overflow-y-auto overscroll-contain rounded-lg border border-border/40 bg-background/40 p-inset-md font-sans text-sm leading-relaxed text-foreground/85 focus-visible:outline focus-visible:outline-accent"
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
}: {
  source: ResearchSourceSummary;
  threadId?: string;
  index: number;
}) {
  const [readText, setReadText] = useState(false);
  const [page, setPage] = useState("");
  const scope = source.excerptOnly
    ? "Search excerpt"
    : source.truncated
      ? "Partial capture"
      : "Captured page";
  const hostname = new URL(source.url).hostname.replace(/^www\./, "");

  return (
    <details className="group/source rounded-xl border border-border/40 bg-background-tertiary/20">
      <summary
        className={cn(
          controlClass,
          "flex cursor-pointer list-none items-start gap-inline-sm p-inset-md"
        )}
      >
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border/50 font-mono text-2xs text-muted-foreground">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-medium leading-relaxed">
            {source.title || hostname}
          </span>
          <span className="mt-stack-xs flex flex-wrap items-center gap-x-inline-sm gap-y-stack-xs text-2xs font-normal text-muted-foreground">
            <span>{hostname}</span>
            <span>{scope}</span>
          </span>
          {source.synopsis ? (
            <span className="mt-stack-sm block text-sm font-normal leading-relaxed text-foreground/80">
              {source.synopsis}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="mt-1 size-4 shrink-0 text-muted-foreground group-open/source:rotate-180"
          aria-hidden
        />
      </summary>
      <div className={cn("border-t border-border/30 p-inset-md", spacing.card.section)}>
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

export function ResearchClaimCard({ claim }: { claim: ResearchClaimView }) {
  return (
    <details className="group/claim rounded-xl border border-border/40 bg-background-tertiary/20">
      <summary
        className={cn(
          controlClass,
          "flex cursor-pointer list-none items-start justify-between gap-inline-sm p-inset-md"
        )}
      >
        <span className="space-y-stack-xs">
          <span className="block text-sm font-medium leading-relaxed">{claim.statement}</span>
          <span className="block text-2xs font-normal text-muted-foreground">
            {claim.issues.length
              ? claim.issues.map((issue) => RESEARCH_ISSUE_LABELS[issue]).join(" · ")
              : "Quotes match captured sources"}
          </span>
        </span>
        <ChevronDown
          className="mt-1 size-4 shrink-0 text-muted-foreground group-open/claim:rotate-180"
          aria-hidden
        />
      </summary>
      <div className={cn("border-t border-border/30 p-inset-md", spacing.card.section)}>
        {claim.assessment ? (
          <div className={spacing.card.labelStack}>
            <p className={labelClass}>Lyra’s assessment</p>
            <p className="text-sm leading-relaxed text-foreground/85">{claim.assessment}</p>
          </div>
        ) : null}
        {claim.evidence.map((evidence, index) => (
          <figure key={`${evidence.sourceId}-${index}`} className="space-y-stack-sm">
            <figcaption className="flex flex-wrap items-center gap-inline-sm text-2xs text-muted-foreground">
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 capitalize",
                  evidence.relation === "contradicts"
                    ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                    : "border-border/50"
                )}
              >
                {evidence.relation}
              </span>
              {evidence.url ? (
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 focus-visible:outline focus-visible:outline-accent"
                >
                  {evidence.title}
                </a>
              ) : (
                <span>{evidence.title}</span>
              )}
              {evidence.page ? <span>Page {evidence.page}</span> : null}
            </figcaption>
            <blockquote className="whitespace-pre-wrap break-words border-l-2 border-accent/40 pl-inset-md text-sm leading-relaxed text-foreground/80">
              {evidence.quote}
              {evidence.quoteTruncated ? "…" : ""}
            </blockquote>
          </figure>
        ))}
        {!claim.evidence.length ? (
          <p className="text-xs text-muted-foreground">
            No evidence has been attached to this claim.
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function ResearchReport({ block }: { block: ResearchReportBlock; partial?: boolean }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-border/50 bg-background-secondary/40 p-inset-lg",
        spacing.card.section
      )}
      aria-label={block.title}
    >
      <header className="space-y-stack-xs">
        <p className={labelClass}>Lyra · Research</p>
        <h3 className="text-base font-semibold leading-relaxed text-foreground">{block.title}</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
          {block.summary}
        </p>
      </header>
      <div className="space-y-stack-sm">
        <p className={labelClass}>Sources · {block.sources.length}</p>
        {block.sources.map((source, index) => (
          <ResearchSourceCard
            key={source.id}
            source={source}
            threadId={block.threadId}
            index={index}
          />
        ))}
      </div>
      {block.claims.length ? (
        <div className="space-y-stack-sm">
          <p className={labelClass}>Findings & evidence</p>
          {block.claims.map((claim) => (
            <ResearchClaimCard key={claim.id} claim={claim} />
          ))}
        </div>
      ) : null}
      {block.limitations.length ? (
        <div className="space-y-stack-sm border-t border-border/30 pt-inset-md">
          <p className={labelClass}>Limitations & open questions</p>
          <ul className="list-disc space-y-stack-sm pl-4 text-xs leading-relaxed text-muted-foreground">
            {block.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-2xs leading-relaxed text-muted-foreground">
        Synopses and takeaways are Lyra’s interpretation. Matching quotations establish
        traceability; assess the source and its methods yourself.
      </p>
    </section>
  );
}
