"use client";

import { z } from "zod";

import { GenUIRenderer } from "./GenUIRenderer";
import { ResearchClaimCard, ResearchSourceCard } from "./blocks/ResearchReport";

import {
  ResearchClaimViewSchema,
  ResearchSourceSummarySchema,
  RESEARCH_ISSUE_LABELS,
  RESEARCH_ISSUES,
} from "@/lib/schemas/gen-ui/research-report";
import { assertSafePublicHttpsUrl } from "@/lib/security/external-content/safe-url";

const ResultSchema = z.object({
  error: z.string().optional(),
  block: z.unknown().optional(),
  threadId: z.string().optional(),
  saved: z.boolean().optional(),
  sources: z.array(z.unknown()).max(60).optional(),
  claim: ResearchClaimViewSchema.optional(),
  untrustedLinks: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .max(30)
    .optional(),
  untrustedStructuredData: z.unknown().optional(),
  untrustedText: z.string().optional(),
  claims: z
    .array(
      z.object({
        id: z.string(),
        statement: z.string(),
        assessment: z.string(),
        issues: z.array(z.enum(RESEARCH_ISSUES)),
      })
    )
    .max(10)
    .optional(),
  exa: z.boolean().optional(),
  firecrawl: z.boolean().optional(),
  docling: z.boolean().optional(),
  evidenceStorage: z.boolean().optional(),
  status: z.string().optional(),
  jobId: z.string().optional(),
  cancelled: z.boolean().optional(),
  completed: z.number().optional(),
  total: z.number().optional(),
  nextOffset: z.number().nullable().optional(),
  totalClaims: z.number().optional(),
});
const PreviewSchema = z
  .object({ url: z.string(), title: z.string().optional(), untrustedText: z.string().optional() })
  .passthrough();
const labels: Record<string, string> = {
  research_capabilities: "Research access",
  research_search: "Sources found",
  research_read: "Pages read",
  research_scrape: "Page captured",
  research_map: "Site pages",
  research_crawl: "Site crawl",
  research_parse_document: "Document parsed",
  research_source: "Captured text",
  research_record_claim: "Finding recorded",
  research_audit: "Evidence review",
};

export function ResearchToolResult({
  toolName,
  output,
  threadId,
}: {
  toolName: string;
  output: unknown;
  threadId?: string;
}) {
  const parsed = ResultSchema.safeParse(output);

  if (!parsed.success)
    return (
      <p className="text-xs text-muted-foreground">Research details could not be displayed.</p>
    );
  const result = parsed.data;

  if (result.block) return <GenUIRenderer data={result.block} />;

  return (
    <details className="not-prose group/research rounded-xl border border-border/40 bg-background-tertiary/20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-inline-sm p-inset-md text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <span>
          {labels[toolName] ?? "Research"}
          {toolName === "research_audit" && result.claims
            ? ` · ${result.claims.length}`
            : result.sources
              ? ` · ${result.sources.length}`
              : ""}
          {result.error ? " · Needs attention" : ""}
        </span>
        <span aria-hidden className="text-muted-foreground group-open/research:rotate-90">
          ›
        </span>
      </summary>
      <div className="space-y-stack-md border-t border-border/30 p-inset-md">
        {result.error ? (
          <p role="status" className="text-xs leading-relaxed text-muted-foreground">
            {result.saved === false
              ? "These results could not be saved to the evidence library. You can still inspect them here."
              : result.error}
          </p>
        ) : null}
        {result.exa !== undefined ? (
          <ul className="space-y-stack-sm text-xs text-muted-foreground">
            {(
              [
                ["Exa", result.exa],
                ["Firecrawl", result.firecrawl],
                ["Docling", result.docling],
                ["Evidence library", result.evidenceStorage],
              ] as const
            ).map(([name, available]) => (
              <li key={name} className="flex justify-between gap-inline-sm">
                <span>{name}</span>
                <span className={available ? "text-foreground" : "text-muted-foreground"}>
                  {available
                    ? name === "Evidence library"
                      ? "Available"
                      : "Configured"
                    : "Unavailable"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {result.sources?.slice(0, 10).map((raw, index) => {
          const preview = PreviewSchema.safeParse(raw);

          if (!preview.success || !assertSafePublicHttpsUrl(preview.data.url).ok) return null;
          const source = ResearchSourceSummarySchema.safeParse({
            ...preview.data,
            preview: (preview.data.untrustedText ?? "").slice(0, 1_200),
            synopsis: "",
            takeaways: [],
          });

          if (source.success)
            return (
              <ResearchSourceCard
                key={`${source.data.id}-${index}`}
                source={source.data}
                threadId={threadId ?? result.threadId}
                index={index}
              />
            );

          return (
            <div key={index} className="space-y-stack-sm">
              <a
                href={preview.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-sm font-medium underline underline-offset-2"
              >
                {preview.data.title || preview.data.url}
              </a>
              {preview.data.untrustedText ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {preview.data.untrustedText.slice(0, 1_200)}
                </p>
              ) : null}
            </div>
          );
        })}
        {result.untrustedLinks ? (
          <ul className="space-y-stack-sm">
            {result.untrustedLinks
              .filter((link) => assertSafePublicHttpsUrl(link.url).ok)
              .map((link, index) => (
                <li key={index} className="space-y-stack-xs">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-words text-sm font-medium underline underline-offset-2"
                  >
                    {link.title || new URL(link.url).hostname}
                  </a>
                  {link.description ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {link.description}
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
        ) : null}
        {result.untrustedStructuredData != null ? (
          <details>
            <summary className="min-h-11 cursor-pointer py-inset-md text-xs font-medium">
              Extracted fields
            </summary>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(result.untrustedStructuredData, null, 2).slice(0, 12_000)}
            </pre>
            <p className="text-2xs text-muted-foreground">
              Extracted values need checking against the captured source.
            </p>
          </details>
        ) : null}
        {result.untrustedText ? (
          <textarea
            className="max-h-96 w-full resize-y overflow-y-auto rounded-lg border border-border/40 bg-background/40 p-inset-md font-sans text-sm leading-relaxed text-foreground/85 focus-visible:outline focus-visible:outline-accent"
            readOnly
            rows={10}
            value={result.untrustedText}
            aria-label="Captured source text"
          />
        ) : null}
        {result.claim ? <ResearchClaimCard claim={result.claim} /> : null}
        {result.claims ? (
          <div className="space-y-stack-md">
            {result.claims.map((claim) => (
              <div key={claim.id} className="space-y-stack-xs">
                <p className="text-sm font-medium leading-relaxed">{claim.statement}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {claim.issues.length
                    ? claim.issues.map((issue) => RESEARCH_ISSUE_LABELS[issue]).join(" · ")
                    : "Quotes match captured sources"}
                </p>
                {claim.assessment ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {claim.assessment}
                  </p>
                ) : null}
              </div>
            ))}
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Reviewed {result.claims.length} of {result.totalClaims ?? result.claims.length}{" "}
              findings. Quotation matching does not certify truth.
              {result.nextOffset !== null && result.nextOffset !== undefined
                ? " More findings remain to review."
                : ""}
            </p>
          </div>
        ) : null}
        {result.status || result.cancelled ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {result.cancelled ? "Crawl cancelled." : `Crawl ${result.status}.`}
            {result.completed !== undefined
              ? ` ${result.completed}${result.total !== undefined ? ` of ${result.total}` : ""} pages collected.`
              : ""}
            {result.jobId ? (
              <span className="mt-stack-xs block break-all font-mono text-2xs">{result.jobId}</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </details>
  );
}
