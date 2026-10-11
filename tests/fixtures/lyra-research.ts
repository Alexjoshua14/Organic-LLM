import type { ResearchReportBlock } from "@/lib/schemas/gen-ui/research-report";

export const FIXTURE_RESEARCH_REPORT: ResearchReportBlock = {
  type: "research-report",
  version: 1,
  threadId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  title: "What the sample tells us",
  summary: "The report describes 120 participants. Generalizability remains uncertain.",
  sources: [
    {
      id: "src-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      url: "https://example.com/study",
      title: "Study methods and results",
      provider: "docling",
      fetchedAt: "2026-10-10T12:00:00.000Z",
      publishedAt: "2026-10-01",
      excerptOnly: false,
      truncated: true,
      capturedChars: 24000,
      pages: [2, 3],
      preview: "The study included 120 participants.",
      synopsis: "An exploratory study describing its sample and methods.",
      takeaways: [
        "The sample size is stated directly; it does not establish applicability to every population.",
      ],
    },
  ],
  claims: [
    {
      id: "claim-a",
      statement: "The study enrolled 120 participants.",
      assessment: "A descriptive finding from the methods section.",
      issues: ["partial_source"],
      evidence: [
        {
          sourceId: "src-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Study methods and results",
          url: "https://example.com/study",
          quote: "The study included 120 participants.",
          quoteTruncated: false,
          relation: "supports",
          page: 2,
        },
      ],
    },
  ],
  limitations: ["Only the requested document pages were captured."],
};
