import type { ResearchIssue } from "@/lib/schemas/gen-ui/research-report";

import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import { RESEARCH_REUSE_LIMIT, ResearchReuseEntrySchema } from "./reuse-schema";

export const RESEARCH_LIMITS = {
  sources: 60,
  sourceChars: 80_000,
  ledgerChars: 1_500_000,
  claims: 100,
  crawls: 10,
  previewChars: 12_000,
} as const;

const LocationSchema = z.object({ page: z.number().int().positive(), text: z.string() });

export const ResearchSourceSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  provider: z.enum(["exa", "firecrawl", "docling"]),
  text: z.string().max(RESEARCH_LIMITS.sourceChars),
  locations: z.array(LocationSchema).max(80),
  sha256: z.string(),
  fetchedAt: z.string(),
  publishedAt: z.string().nullable(),
  excerptOnly: z.boolean(),
  truncated: z.boolean(),
});
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type RetrievedSource = Omit<ResearchSource, "id" | "sha256" | "fetchedAt">;

export const EvidenceInputSchema = z.object({
  sourceId: z.string().min(1),
  quote: z.string().trim().min(10).max(4_000),
  relation: z.enum(["supports", "contradicts", "context"]),
  page: z.number().int().positive().optional(),
});
export const ClaimInputSchema = z.object({
  id: z.string().optional().describe("Omit for a new claim; supply an existing id to revise it."),
  statement: z.string().trim().min(1).max(2_000),
  evidence: z.array(EvidenceInputSchema).max(12),
  assessment: z
    .string()
    .max(2_000)
    .default("")
    .describe("Your interpretation and limitations; not an automatic fact-check verdict."),
});
const ClaimSchema = ClaimInputSchema.extend({ id: z.string(), updatedAt: z.string() });

export type ResearchClaim = z.infer<typeof ClaimSchema>;
const CrawlSchema = z.object({ id: z.string(), url: z.string().url(), createdAt: z.string() });

export const ResearchLedgerSchema = z.object({
  version: z.literal(1),
  sources: z.array(ResearchSourceSchema).max(RESEARCH_LIMITS.sources),
  claims: z.array(ClaimSchema).max(RESEARCH_LIMITS.claims),
  crawls: z.array(CrawlSchema).max(RESEARCH_LIMITS.crawls),
  reuse: z.array(ResearchReuseEntrySchema).max(RESEARCH_REUSE_LIMIT).default([]),
});
export type ResearchLedger = z.infer<typeof ResearchLedgerSchema>;
export const emptyResearchLedger = (): ResearchLedger => ({
  version: 1,
  sources: [],
  claims: [],
  crawls: [],
  reuse: [],
});

export type LedgerEdit<T> =
  | { ok: true; ledger: ResearchLedger; value: T }
  | { ok: false; error: string };
export type ResearchLedgerStore = {
  load(): Promise<{ ledger: ResearchLedger; revision: string | null } | null>;
  save(
    ledger: ResearchLedger,
    revision: string | null
  ): Promise<{ status: "saved"; revision: string } | { status: "conflict" | "unavailable" }>;
};
export const LEDGER_UNAVAILABLE =
  "Research evidence storage is unavailable. Check the research_ledgers.sql migration and thread/ledger ownership.";

/** Serialized in one run; revision conflicts reload and reapply without dropping another run's evidence. */
export function createResearchLedgerSession(store: ResearchLedgerStore) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);

    queue = next.catch(() => undefined);

    return next;
  };

  return {
    read: () => serial(async () => (await store.load())?.ledger ?? null),
    mutate: <T>(apply: (ledger: ResearchLedger) => LedgerEdit<T>): Promise<LedgerEdit<T>> =>
      serial(async () => {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const state = await store.load();

          if (!state) return { ok: false, error: LEDGER_UNAVAILABLE };
          const edited = apply(state.ledger);

          if (!edited.ok) return edited;
          if (JSON.stringify(edited.ledger).length > RESEARCH_LIMITS.ledgerChars)
            return {
              ok: false,
              error: "This research ledger is full. Start a new research thread.",
            };
          const saved = await store.save(edited.ledger, state.revision);

          if (saved.status === "saved") return edited;
          if (saved.status === "unavailable") return { ok: false, error: LEDGER_UNAVAILABLE };
        }

        return {
          ok: false,
          error: "Research evidence changed concurrently. Retry this operation.",
        };
      }),
  };
}
export type ResearchLedgerSession = ReturnType<typeof createResearchLedgerSession>;

/** Immutable snapshots: a later fetch never rewrites evidence cited by an earlier claim. */
export function captureSources(
  ledger: ResearchLedger,
  inputs: RetrievedSource[],
  now: string
): LedgerEdit<ResearchSource[]> {
  const sources = [...ledger.sources];
  const captured = inputs.map((input) => {
    const text = input.text.slice(0, RESEARCH_LIMITS.sourceChars);
    const locations = input.locations
      .slice(0, 80)
      .map((l) => ({ ...l, text: l.text.slice(0, 8_000) }));
    const sha256 = createHash("sha256").update(JSON.stringify({ text, locations })).digest("hex");
    const existing = sources.find(
      (s) =>
        s.url === input.url &&
        s.sha256 === sha256 &&
        s.provider === input.provider &&
        s.excerptOnly === input.excerptOnly
    );

    if (existing) return existing;
    const source: ResearchSource = {
      ...input,
      title: input.title.slice(0, 512),
      publishedAt: input.publishedAt?.slice(0, 100) ?? null,
      text,
      locations,
      id: `src-${randomUUID()}`,
      sha256,
      fetchedAt: now,
      truncated:
        input.truncated ||
        input.text.length >= RESEARCH_LIMITS.sourceChars ||
        input.locations.length > 80 ||
        input.locations.some((location) => location.text.length > 8_000),
    };

    sources.push(source);

    return source;
  });

  if (sources.length > RESEARCH_LIMITS.sources)
    return {
      ok: false,
      error: "This ledger has reached its source limit. Start a new research thread.",
    };

  return { ok: true, ledger: { ...ledger, sources }, value: captured };
}

const normalizeQuote = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();

export function evidenceMatches(
  source: ResearchSource,
  evidence: z.infer<typeof EvidenceInputSchema>
): boolean {
  const text =
    evidence.page === undefined
      ? source.text
      : source.locations
          .filter((l) => l.page === evidence.page)
          .map((l) => l.text)
          .join("\n");

  return normalizeQuote(text).includes(normalizeQuote(evidence.quote));
}

export function recordClaim(
  ledger: ResearchLedger,
  input: z.infer<typeof ClaimInputSchema>,
  now: string
): LedgerEdit<ResearchClaim> {
  if (input.id && !ledger.claims.some((c) => c.id === input.id))
    return { ok: false, error: "Unknown claim id." };
  for (const evidence of input.evidence) {
    const source = ledger.sources.find((s) => s.id === evidence.sourceId);

    if (!source)
      return {
        ok: false,
        error: `Unknown source ${evidence.sourceId}. Read and capture the source first.`,
      };
    if (!evidenceMatches(source, evidence))
      return {
        ok: false,
        error: `The quotation does not match the captured source ${evidence.sourceId}${evidence.page ? ` on page ${evidence.page}` : ""}.`,
      };
  }
  const claim: ResearchClaim = {
    ...input,
    id: input.id ?? `claim-${randomUUID()}`,
    updatedAt: now,
  };
  const claims = input.id
    ? ledger.claims.map((c) => (c.id === input.id ? claim : c))
    : [...ledger.claims, claim];

  if (claims.length > RESEARCH_LIMITS.claims)
    return { ok: false, error: "This ledger has reached its claim limit." };

  return { ok: true, ledger: { ...ledger, claims }, value: claim };
}

/** Checks traceability. The relation between a quote and a claim remains the researcher's judgment. */
export function auditResearchLedger(ledger: ResearchLedger) {
  return {
    claims: ledger.claims.map((claim) => {
      const issues: ResearchIssue[] = [];

      if (!claim.evidence.some((e) => e.relation === "supports"))
        issues.push("no_supporting_evidence");
      if (claim.evidence.some((e) => e.relation === "contradicts"))
        issues.push("contradictory_evidence");
      const urls = new Set<string>();

      for (const evidence of claim.evidence) {
        const source = ledger.sources.find((s) => s.id === evidence.sourceId);

        if (!source) {
          issues.push("missing_source");
          continue;
        }
        if (!evidenceMatches(source, evidence)) issues.push("quote_mismatch");
        if (source.excerptOnly) issues.push("search_excerpt_only");
        if (source.truncated) issues.push("partial_source");
        if (evidence.relation === "supports") urls.add(source.url);
      }

      return { ...claim, supportingSourceCount: urls.size, issues: [...new Set(issues)] };
    }),
    sources: ledger.sources.map(({ text: _text, locations: _locations, ...source }) => source),
    note: "Quotation matching establishes source traceability. It does not establish truth, methodological quality, or independence between publishers.",
  };
}
