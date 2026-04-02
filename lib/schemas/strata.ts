import z from "zod";

export const StrataSectionKeySchema = z.enum([
  "raw_text",
  "refined_text",
  "elaborated",
  "design_instructions",
  "ai_instructions",
]);

export type StrataSectionKey = z.infer<typeof StrataSectionKeySchema>;

export const STRATA_SECTION_ORDER: StrataSectionKey[] = [
  "raw_text",
  "refined_text",
  "elaborated",
  "design_instructions",
  "ai_instructions",
];

export const STRATA_DEFAULT_DESIGN_INSTRUCTIONS = `Desktop-first editorial canvas for a 14-inch laptop.
- Render five distinct full-height sections with clear spacing.
- Use elegant typography, calm contrast, and generous whitespace.
- Keep "Raw Text" visually separate from AI-generated sections.
- Favor readable line length (~70-90 chars) and strong hierarchy.`;

export const STRATA_DEFAULT_AI_INSTRUCTIONS = `You are the Strata section composer.
- Use Raw Text as the source of truth.
- Produce Refined Text as near 1:1 cleanup (formatting and clarity only).
- Produce Elaborated content that improves comprehension without inventing unsupported facts.
- Never rewrite Raw Text.
- Never edit Design Instructions or AI Instructions unless explicitly requested.`;

export type StrataSection = {
  key: StrataSectionKey;
  content: string;
  contentJson: Record<string, unknown> | null;
};

export const StrataGenerationContextSchema = z.object({
  lastGeneratedRawText: z.string(),
  lastGeneratedAt: z.string(),
  lastGenerationMode: z.enum(["create", "update"]),
  lastRawDiffSummary: z.string().optional(),
});

export type StrataGenerationContext = z.infer<typeof StrataGenerationContextSchema>;

export type StrataPage = {
  id: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type StrataPageWithSections = {
  page: StrataPage;
  sections: Record<StrataSectionKey, StrataSection>;
};

export function buildDefaultStrataSections(): Record<StrataSectionKey, StrataSection> {
  return {
    raw_text: { key: "raw_text", content: "", contentJson: null },
    refined_text: { key: "refined_text", content: "", contentJson: null },
    elaborated: { key: "elaborated", content: "", contentJson: null },
    design_instructions: {
      key: "design_instructions",
      content: STRATA_DEFAULT_DESIGN_INSTRUCTIONS,
      contentJson: null,
    },
    ai_instructions: {
      key: "ai_instructions",
      content: STRATA_DEFAULT_AI_INSTRUCTIONS,
      contentJson: null,
    },
  };
}

export function buildStrataPageDefaults(
  pageId: string,
  title: string,
  ownerId: string = "local-device"
): StrataPageWithSections {
  const now = new Date().toISOString();
  return {
    page: {
      id: pageId,
      title,
      owner_id: ownerId,
      created_at: now,
      updated_at: now,
    },
    sections: buildDefaultStrataSections(),
  };
}

export const StrataSectionsSnapshotSchema = z.object({
  raw_text: z.string().default(""),
  refined_text: z.string().default(""),
  elaborated: z.string().default(""),
  design_instructions: z.string().default(""),
  ai_instructions: z.string().default(""),
});

export const StrataRawGenerationMetadataSchema = z.object({
  generationContext: StrataGenerationContextSchema.optional(),
});

export const StrataGenerateRequestSchema = z
  .object({
    pageId: z.string().uuid().optional(),
    mode: z.enum(["create", "update"]),
    sectionsSnapshot: StrataSectionsSnapshotSchema.optional(),
    rawGenerationMetadata: StrataRawGenerationMetadataSchema.optional(),
  })
  .refine((value) => value.sectionsSnapshot != null || value.pageId != null, {
    message: "Either pageId or sectionsSnapshot is required",
    path: ["pageId"],
  });

export const StrataGenerateResponseSchema = z.object({
  refinedTitle: z.string().min(1),
  refinedText: z.string().min(1),
  elaborated: z.string().min(1),
  elaboratedArtifacts: z.record(z.string(), z.unknown()).optional(),
  rawGenerationContext: StrataGenerationContextSchema.optional(),
});

export type StrataGenerateResponse = z.infer<typeof StrataGenerateResponseSchema>;
