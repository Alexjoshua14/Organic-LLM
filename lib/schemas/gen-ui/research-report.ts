import { z } from "zod";

import { GEN_UI_VERSION, httpUrl } from "./shared";

import { assertSafePublicHttpsUrl } from "@/lib/security/external-content/safe-url";

const SourceUrlSchema = httpUrl().refine((url) => assertSafePublicHttpsUrl(url).ok);

export const RESEARCH_PUBLISH_TOOL_NAME = "research_publish";
export const RESEARCH_ISSUES = [
  "no_supporting_evidence",
  "contradictory_evidence",
  "missing_source",
  "quote_mismatch",
  "search_excerpt_only",
  "partial_source",
] as const;
export type ResearchIssue = (typeof RESEARCH_ISSUES)[number];
export const ResearchSourceSummarySchema = z.object({
  id: z.string().min(1).max(128),
  url: SourceUrlSchema,
  title: z.string().max(512),
  provider: z.enum(["exa", "firecrawl", "docling"]),
  fetchedAt: z.string().max(100),
  publishedAt: z.string().max(100).nullable(),
  excerptOnly: z.boolean(),
  truncated: z.boolean(),
  capturedChars: z.number().int().nonnegative(),
  pages: z.array(z.number().int().positive()).max(80),
  preview: z.string().max(1_200),
  synopsis: z.string().max(1_200).default(""),
  takeaways: z.array(z.string().max(500)).max(5).default([]),
});
export type ResearchSourceSummary = z.infer<typeof ResearchSourceSummarySchema>;

export const RESEARCH_ISSUE_LABELS = {
  no_supporting_evidence: "No supporting evidence",
  contradictory_evidence: "Contradictory evidence",
  missing_source: "Source unavailable",
  quote_mismatch: "Quote does not match",
  search_excerpt_only: "Search excerpts only",
  partial_source: "Partial source",
} as const;
export const ResearchClaimViewSchema = z.object({
  id: z.string().max(128),
  statement: z.string().max(2_000),
  assessment: z.string().max(2_000),
  issues: z.array(z.enum(RESEARCH_ISSUES)).max(6),
  evidence: z
    .array(
      z.object({
        sourceId: z.string().max(128),
        title: z.string().max(512),
        url: SourceUrlSchema.optional(),
        quote: z.string().max(1_000),
        quoteTruncated: z.boolean(),
        relation: z.enum(["supports", "contradicts", "context"]),
        page: z.number().int().positive().optional(),
      })
    )
    .max(12),
});
export type ResearchClaimView = z.infer<typeof ResearchClaimViewSchema>;

export const ResearchReportBlockSchema = z.object({
  type: z.literal("research-report"),
  version: GEN_UI_VERSION,
  threadId: z.string().uuid(),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(2_000),
  sources: z.array(ResearchSourceSummarySchema).max(8),
  claims: z.array(ResearchClaimViewSchema).max(6),
  limitations: z.array(z.string().max(500)).max(8),
});
export type ResearchReportBlock = z.infer<typeof ResearchReportBlockSchema>;

export const ResearchSourceSliceSchema = z.object({
  sourceId: z.string(),
  url: SourceUrlSchema,
  sha256: z.string(),
  page: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative(),
  capturedChars: z.number().int().nonnegative(),
  untrustedText: z.string().max(12_000),
  nextOffset: z.number().int().nonnegative().nullable(),
});

export function researchReportToMarkdown(block: ResearchReportBlock): string {
  const lines = [`## ${block.title}`, "", block.summary, ""];

  for (const source of block.sources) {
    lines.push(`### [${source.title}](${source.url})`, "", source.synopsis || source.preview);
    if (source.takeaways.length)
      lines.push("", "Lyra’s takeaways:", ...source.takeaways.map((t) => `- ${t}`));
    lines.push(
      "",
      `_${source.excerptOnly ? "Search excerpt" : source.truncated ? "Partial capture" : "Captured source"}; ${source.id}_`,
      ""
    );
  }
  for (const claim of block.claims) {
    lines.push(`### ${claim.statement}`, "", claim.assessment);
    for (const evidence of claim.evidence) {
      lines.push(
        "",
        `> ${evidence.quote.replace(/\n/g, "\n> ")}${evidence.quoteTruncated ? "…" : ""}`,
        "",
        `${evidence.relation}: ${evidence.url ? `[${evidence.title}](${evidence.url})` : evidence.sourceId}${evidence.page ? `, page ${evidence.page}` : ""}`
      );
    }
    if (claim.issues.length)
      lines.push("", ...claim.issues.map((issue) => `- ${RESEARCH_ISSUE_LABELS[issue]}`));
    lines.push("");
  }
  if (block.limitations.length)
    lines.push("Limitations:", ...block.limitations.map((l) => `- ${l}`));

  return lines.join("\n").trim();
}

export function researchReportToMarkdownLoose(raw: Record<string, unknown>): string {
  const parsed = ResearchReportBlockSchema.safeParse(raw);

  if (parsed.success) return researchReportToMarkdown(parsed.data);

  return [
    typeof raw.title === "string" ? raw.title : "Research report",
    typeof raw.summary === "string" ? raw.summary : "Report details are unavailable.",
  ].join("\n\n");
}
