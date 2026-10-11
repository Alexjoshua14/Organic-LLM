import "server-only";

import type {
  ResearchLedgerSession,
  ResearchLedgerStore,
  RetrievedSource,
  ResearchSource,
} from "./ledger";
import type { ResearchProviders } from "./providers";

import { tool } from "ai";
import { z } from "zod";

import {
  auditResearchLedger,
  captureSources,
  ClaimInputSchema,
  createResearchLedgerSession,
  LEDGER_UNAVAILABLE,
  recordClaim,
  RESEARCH_LIMITS,
} from "./ledger";
import { createResearchProviders } from "./providers";
import { presentResearchClaim, readResearchSource, summarizeResearchSource } from "./presentation";

import { createSupabaseResearchLedgerStore } from "@/data/supabase/research-ledger";
import { checkExternalFetchLimit } from "@/lib/rate-limit/external-fetch";
import {
  UNTRUSTED_EXTERNAL_CONTENT_GUARDRAIL,
  sanitizeUntrustedText,
} from "@/lib/security/external-content/untrusted";
import { ResearchReportBlockSchema } from "@/lib/schemas/gen-ui/research-report";

const MAX_PROVIDER_CALLS_PER_TURN = 12;
const UrlSchema = z.string().url().max(2_000);
const CrawlIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,120}$/);
const DateSchema = z.string().datetime();
const ExtractionFieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
  description: z.string().min(1).max(400),
  type: z.enum(["string", "number", "boolean"]),
});

export const RESEARCH_TOOL_INSTRUCTIONS = `Research tools:
- Check research_capabilities when a provider may be unavailable. Report unavailable access plainly.
- research_search discovers sources with domain/date/category controls. Search snapshots are excerpts: read important sources with research_read, research_scrape, or research_parse_document before using them as decisive evidence.
- research_read fetches up to five URLs through Exa. research_scrape reads a page with Firecrawl and optionally extracts named fields. Extraction fields are interpretations; verify important values against the captured page.
- research_map discovers a site's pages. research_crawl starts, checks, or cancels a bounded asynchronous crawl. Only poll job ids started in this thread. If still running, report its id for a later assignment; do not spend the turn repeatedly polling.
- research_parse_document reads a bounded page range through Docling with OCR and tables. It returns available page locations; do not claim a page citation when no matching page text was captured.
- Retrieval captures immutable sources in this thread's encrypted evidence ledger. Use research_source to read additional portions by sourceId and offset or page. Respect partial-source flags.
- Record each substantial conclusion with research_record_claim. Cite sourceIds and matching quotations; include contradictory evidence and explain your assessment. Quote matching checks provenance, not truth or methodological quality.
- Before your handoff, call research_audit (page through additional claims when present). Return findings with clickable source links, claim/source ids, dates, limitations and unresolved contradictions. Preserve unsupported findings as open questions. Repeated pages or publishers that repeat one source do not establish independent corroboration.
- Publish a browsable research report with research_publish after reading sources and recording claims. Include article synopses and your takeaways, distinguishing reported facts from your interpretation. The server supplies saved source links, capture scope and quotations. Users can inspect captured text in your chat. If storage is unavailable, use prose and the retrieval results instead; never pretend a report was saved.
- At most ${MAX_PROVIDER_CALLS_PER_TURN} provider calls per turn. Choose sources deliberately.
${UNTRUSTED_EXTERNAL_CONTENT_GUARDRAIL}`;

export function createResearchTools(args: {
  threadId: string;
  ownerId: string;
  store?: ResearchLedgerStore;
  providers?: ResearchProviders;
  checkLimit?: (ownerId: string) => Promise<{ success: boolean; error?: string }>;
  now?: () => string;
}) {
  const providers = args.providers ?? createResearchProviders();
  const session: ResearchLedgerSession = createResearchLedgerSession(
    args.store ?? createSupabaseResearchLedgerStore(args)
  );
  const checkLimit = args.checkLimit ?? checkExternalFetchLimit;
  const now = args.now ?? (() => new Date().toISOString());
  let calls = 0;
  let published = 0;

  async function safe<T>(task: () => Promise<T>) {
    try {
      return await task();
    } catch (error) {
      return {
        error:
          error instanceof z.ZodError
            ? "Research provider response did not match its expected format."
            : error instanceof Error
              ? error.message
              : "Research operation failed.",
      };
    }
  }
  async function external<T>(task: () => Promise<T>) {
    if (calls >= MAX_PROVIDER_CALLS_PER_TURN)
      throw new Error(
        "This turn has reached its research provider call limit. Hand off the findings gathered so far."
      );
    calls += 1;
    const limit = await checkLimit(args.ownerId);

    if (!limit.success) throw new Error(limit.error ?? "Research request limit reached.");

    return task();
  }
  function preview(source: ResearchSource) {
    const { text, locations, ...metadata } = source;

    return {
      ...metadata,
      title: sanitizeUntrustedText(source.title, 512),
      capturedChars: text.length,
      pages: [...new Set(locations.map((l) => l.page))],
      untrustedText: sanitizeUntrustedText(text.slice(0, RESEARCH_LIMITS.previewChars)),
      nextOffset: text.length > RESEARCH_LIMITS.previewChars ? RESEARCH_LIMITS.previewChars : null,
    };
  }
  async function capture(sources: RetrievedSource[]) {
    const outcome = await session.mutate((ledger) => captureSources(ledger, sources, now()));

    if (!outcome.ok)
      return {
        threadId: args.threadId,
        sources: sources.map((s) => ({
          url: s.url,
          title: sanitizeUntrustedText(s.title, 512),
          untrustedText: sanitizeUntrustedText(s.text, RESEARCH_LIMITS.previewChars),
        })),
        saved: false,
        error: outcome.error,
      };

    return { threadId: args.threadId, saved: true, sources: outcome.value.map(preview) };
  }

  return {
    research_capabilities: tool({
      description:
        "Check configured research providers and this thread's durable evidence storage.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => ({
          ...providers.capabilities(),
          evidenceStorage: Boolean(await session.read()),
        })),
    }),
    research_search: tool({
      description:
        "Discover research sources using Exa with domain, publication date and category filters. Results are search excerpts, not complete source reads.",
      inputSchema: z
        .object({
          query: z.string().trim().min(1).max(1_000),
          numResults: z.number().int().min(1).max(10).default(6),
          includeDomains: z.array(z.string().min(1).max(200)).max(10).optional(),
          excludeDomains: z.array(z.string().min(1).max(200)).max(10).optional(),
          startPublishedDate: DateSchema.optional(),
          endPublishedDate: DateSchema.optional(),
          category: z.enum(["research paper", "news", "company"]).optional(),
        })
        .refine(
          (a) =>
            !a.startPublishedDate ||
            !a.endPublishedDate ||
            a.startPublishedDate <= a.endPublishedDate,
          "Publication date range is reversed."
        ),
      execute: (input) => safe(async () => capture(await external(() => providers.search(input)))),
    }),
    research_read: tool({
      description:
        "Read complete page text through Exa and capture source snapshots. Use research_source for text beyond the initial preview.",
      inputSchema: z.object({
        urls: z.array(UrlSchema).min(1).max(5),
        fresh: z.boolean().default(false),
      }),
      execute: ({ urls, fresh }) =>
        safe(async () => {
          const result = await external(() => providers.read(urls, fresh));

          return { ...(await capture(result.sources)), statuses: result.statuses };
        }),
    }),
    research_scrape: tool({
      description:
        "Scrape a page through Firecrawl, capture its markdown, and optionally extract a small set of structured fields.",
      inputSchema: z.object({
        url: UrlSchema,
        fields: z.array(ExtractionFieldSchema).max(12).default([]),
      }),
      execute: ({ url, fields }) =>
        safe(async () => {
          if (new Set(fields.map((f) => f.name)).size !== fields.length)
            throw new Error("Extraction field names must be unique.");
          const result = await external(() => providers.scrape(url, fields));

          return {
            ...(await capture([result.source])),
            untrustedStructuredData: result.structuredData,
          };
        }),
    }),
    research_map: tool({
      description:
        "Discover up to 30 URLs on a website using Firecrawl before choosing pages to read.",
      inputSchema: z.object({ url: UrlSchema, search: z.string().max(400).optional() }),
      execute: ({ url, search }) =>
        safe(async () => ({ untrustedLinks: await external(() => providers.map(url, search)) })),
    }),
    research_crawl: tool({
      description:
        "Start a bounded Firecrawl crawl, retrieve its results, or cancel it. Jobs remain associated with this thread across assignments.",
      inputSchema: z.discriminatedUnion("action", [
        z.object({
          action: z.literal("start"),
          url: UrlSchema,
          limit: z.number().int().min(1).max(10).default(5),
          includePaths: z.array(z.string().max(200)).max(10).optional(),
        }),
        z.object({
          action: z.literal("status"),
          jobId: CrawlIdSchema,
          skip: z.number().int().min(0).max(10).default(0),
        }),
        z.object({ action: z.literal("cancel"), jobId: CrawlIdSchema }),
      ]),
      execute: (input) =>
        safe(async () => {
          const ledger = await session.read();

          if (!ledger) return { error: LEDGER_UNAVAILABLE };
          if (input.action === "start") {
            if (ledger.crawls.length >= RESEARCH_LIMITS.crawls)
              return { error: "This thread has reached its crawl job limit." };
            const job = await external(() =>
              providers.startCrawl(input.url, input.limit, input.includePaths)
            );
            let persisted = false;

            try {
              const saved = await session.mutate((current) =>
                current.crawls.length >= RESEARCH_LIMITS.crawls
                  ? { ok: false, error: "This thread has reached its crawl job limit." }
                  : {
                      ok: true,
                      ledger: {
                        ...current,
                        crawls: [...current.crawls, { ...job, createdAt: now() }],
                      },
                      value: job,
                    }
              );

              if (!saved.ok) return { error: saved.error };
              persisted = true;

              return { jobId: job.id, status: "started", limit: input.limit };
            } finally {
              if (!persisted) await providers.cancelCrawl(job.id).catch(() => undefined);
            }
          }
          const job = ledger.crawls.find((c) => c.id === input.jobId);

          if (!job) return { error: "Unknown crawl job in this thread." };
          if (input.action === "cancel") return external(() => providers.cancelCrawl(job.id));
          const { sources, ...status } = await external(() =>
            providers.crawlStatus(job.id, job.url, input.skip)
          );

          return { jobId: job.id, ...status, ...(await capture(sources)) };
        }),
    }),
    research_parse_document: tool({
      description:
        "Parse a report or paper using Docling OCR and table recognition. Capture markdown and available page provenance for at most 40 pages per call.",
      inputSchema: z
        .object({
          url: UrlSchema,
          firstPage: z.number().int().min(1).max(2_000).default(1),
          lastPage: z.number().int().min(1).max(2_000).default(40),
        })
        .refine(
          (a) => a.lastPage >= a.firstPage && a.lastPage - a.firstPage < 40,
          "Choose a page range of at most 40 pages."
        ),
      execute: ({ url, firstPage, lastPage }) =>
        safe(async () => {
          const { source, ...result } = await external(() =>
            providers.parseDocument(url, firstPage, lastPage)
          );

          return { ...result, ...(await capture([source])) };
        }),
    }),
    research_source: tool({
      description:
        "Read another portion of an immutable source snapshot, optionally from a captured document page. Uses the evidence ledger without another provider call.",
      inputSchema: z.object({
        sourceId: z.string(),
        offset: z.number().int().nonnegative().default(0),
        limit: z
          .number()
          .int()
          .min(1)
          .max(RESEARCH_LIMITS.previewChars)
          .default(RESEARCH_LIMITS.previewChars),
        page: z.number().int().positive().optional(),
      }),
      execute: ({ sourceId, offset, limit, page }) =>
        safe(async () => {
          const ledger = await session.read();

          if (!ledger) return { error: LEDGER_UNAVAILABLE };

          return readResearchSource(ledger, { sourceId, offset, limit, page });
        }),
    }),
    research_record_claim: tool({
      description:
        "Record or revise a research claim with exact source quotations, supporting/contradicting evidence, and your assessment. Refuses unknown sources and quotations that do not match captured text.",
      inputSchema: ClaimInputSchema,
      execute: (input) =>
        safe(async () => {
          const result = await session.mutate((ledger) => recordClaim(ledger, input, now()));

          return result.ok
            ? { saved: true, claim: presentResearchClaim(result.ledger, result.value) }
            : { error: result.error };
        }),
    }),
    research_publish: tool({
      description:
        "Publish an inspectable Gen UI research report in your chat. Supply synopses and takeaways for saved sources and ids of recorded claims; source metadata and evidence come from this thread's ledger. At most two reports per turn.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        summary: z.string().min(1).max(2_000),
        sources: z
          .array(
            z.object({
              sourceId: z.string(),
              synopsis: z.string().max(1_200),
              takeaways: z.array(z.string().max(500)).max(5).default([]),
            })
          )
          .max(8),
        claimIds: z.array(z.string()).max(6).default([]),
        limitations: z.array(z.string().max(500)).max(8).default([]),
      }),
      execute: (input) =>
        safe(async () => {
          if (published >= 2) return { error: "This turn has reached its research report limit." };
          const ledger = await session.read();

          if (!ledger) return { error: LEDGER_UNAVAILABLE };
          if (
            new Set(input.sources.map((source) => source.sourceId)).size !== input.sources.length ||
            new Set(input.claimIds).size !== input.claimIds.length
          )
            return { error: "Choose each source and claim only once." };
          const claims = input.claimIds.map((id) => ledger.claims.find((claim) => claim.id === id));

          if (claims.some((claim) => !claim)) return { error: "Unknown claim id in this thread." };
          const sourceIds = [
            ...new Set([
              ...input.sources.map((source) => source.sourceId),
              ...claims.flatMap((claim) => claim!.evidence.map((evidence) => evidence.sourceId)),
            ]),
          ];

          if (!sourceIds.length)
            return { error: "Include at least one saved source in the report." };
          if (sourceIds.length > 8)
            return {
              error: "These claims cite more than eight sources. Publish a smaller report.",
            };
          const sources = sourceIds.map((id) => ledger.sources.find((source) => source.id === id));

          if (sources.some((source) => !source))
            return { error: "Unknown source id in this thread." };
          const block = ResearchReportBlockSchema.parse({
            type: "research-report",
            version: 1,
            threadId: args.threadId,
            title: input.title,
            summary: input.summary,
            sources: sources.map((source) => {
              const annotation = input.sources.find((item) => item.sourceId === source!.id);

              return {
                ...summarizeResearchSource(source!),
                synopsis: annotation?.synopsis ?? "",
                takeaways: annotation?.takeaways ?? [],
              };
            }),
            claims: claims.map((claim) => presentResearchClaim(ledger, claim!)),
            limitations: input.limitations,
          });

          if (JSON.stringify(block).length > 96_000)
            return { error: "This report is too large. Publish fewer claims or sources." };
          published += 1;

          return { block };
        }),
    }),
    research_audit: tool({
      description:
        "Inspect the saved research package and flag unsupported claims, contradictory evidence, quote mismatches, excerpt-only evidence and partial sources. Does not certify truth.",
      inputSchema: z.object({
        offset: z.number().int().min(0).max(RESEARCH_LIMITS.claims).default(0),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: ({ offset = 0, limit = 5 }) =>
        safe(async () => {
          const ledger = await session.read();

          if (!ledger) return { error: LEDGER_UNAVAILABLE };
          const audit = auditResearchLedger(ledger);
          const claims = audit.claims
            .slice(offset, offset + limit)
            .map(({ evidence, ...claim }) => ({
              ...claim,
              evidence: evidence.map(({ quote: _quote, ...entry }) => entry),
            }));

          return {
            claims,
            sources: audit.sources,
            note: audit.note,
            crawlJobs: ledger.crawls,
            totalClaims: ledger.claims.length,
            nextOffset: offset + limit < ledger.claims.length ? offset + limit : null,
          };
        }),
    }),
  };
}
