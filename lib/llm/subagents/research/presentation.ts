import type { ResearchClaim, ResearchLedger, ResearchSource } from "./ledger";
import type {
  ResearchClaimView,
  ResearchSourceSummary,
} from "@/lib/schemas/gen-ui/research-report";

import { auditResearchLedger } from "./ledger";

import { sanitizeUntrustedText } from "@/lib/security/external-content/untrusted";

/** Server-selected metadata and evidence; Lyra supplies only her synopsis and interpretation. */
export function summarizeResearchSource(source: ResearchSource): ResearchSourceSummary {
  return {
    id: source.id,
    url: source.url,
    title: sanitizeUntrustedText(source.title, 512),
    provider: source.provider,
    fetchedAt: source.fetchedAt,
    publishedAt: source.publishedAt,
    excerptOnly: source.excerptOnly,
    truncated: source.truncated,
    capturedChars: source.text.length,
    pages: [...new Set(source.locations.map((location) => location.page))],
    preview: sanitizeUntrustedText(source.text, 1_200),
    synopsis: "",
    takeaways: [],
  };
}

export function presentResearchClaim(
  ledger: ResearchLedger,
  claim: ResearchClaim
): ResearchClaimView {
  const audit = auditResearchLedger({ ...ledger, claims: [claim] }).claims[0]!;

  return {
    id: claim.id,
    statement: claim.statement,
    assessment: claim.assessment,
    issues: audit.issues,
    evidence: claim.evidence.map((evidence) => {
      const source = ledger.sources.find((item) => item.id === evidence.sourceId);

      return {
        ...evidence,
        title: source ? sanitizeUntrustedText(source.title, 512) : "Unavailable source",
        url: source?.url,
        quote: evidence.quote.slice(0, 1_000),
        quoteTruncated: evidence.quote.length > 1_000,
      };
    }),
  };
}

export function readResearchSource(
  ledger: ResearchLedger,
  args: { sourceId: string; offset: number; limit: number; page?: number }
) {
  const { sourceId, offset, limit, page } = args;
  const source = ledger.sources.find((item) => item.id === sourceId);

  if (!source) return { error: "Unknown source id in this thread." };
  const text =
    page === undefined
      ? source.text
      : source.locations
          .filter((location) => location.page === page)
          .map((location) => location.text)
          .join("\n");

  if (page !== undefined && !text)
    return { error: "This source has no captured text for that page." };

  return {
    sourceId,
    url: source.url,
    sha256: source.sha256,
    page,
    offset,
    capturedChars: text.length,
    untrustedText: sanitizeUntrustedText(text.slice(offset, offset + limit), limit),
    nextOffset: offset + limit < text.length ? offset + limit : null,
  };
}
