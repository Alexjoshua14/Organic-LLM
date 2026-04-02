import {
  STRATA_DEFAULT_AI_INSTRUCTIONS,
  STRATA_DEFAULT_DESIGN_INSTRUCTIONS,
  STRATA_SECTION_ORDER,
  type StrataSection,
  type StrataSectionKey,
} from "@/lib/schemas/strata";

export function isGeneratedSectionMissing(
  value: Pick<StrataSection, "content"> | undefined | null
): boolean {
  if (!value) return true;
  return value.content.trim().length === 0;
}

export function buildDefaultStrataSectionRows(pageId: string): Array<{
  page_id: string;
  section_key: StrataSectionKey;
  content: string;
}> {
  return STRATA_SECTION_ORDER.map((sectionKey) => ({
    page_id: pageId,
    section_key: sectionKey,
    content:
      sectionKey === "design_instructions"
        ? STRATA_DEFAULT_DESIGN_INSTRUCTIONS
        : sectionKey === "ai_instructions"
          ? STRATA_DEFAULT_AI_INSTRUCTIONS
          : "",
  }));
}

function sectionTitleFromKey(key: StrataSectionKey): string {
  switch (key) {
    case "raw_text":
      return "Raw Text";
    case "refined_text":
      return "Refined Text";
    case "elaborated":
      return "Elaborated";
    case "design_instructions":
      return "Design Instructions";
    case "ai_instructions":
      return "AI Instructions";
    default:
      return key;
  }
}

export function buildGeneratedSectionUpserts(args: {
  existing: Record<StrataSectionKey, StrataSection>;
  refinedTitle: string;
  refinedText: string;
  elaborated: string;
  elaboratedArtifacts?: Record<string, unknown>;
  overwriteElaborated?: boolean;
}): Array<{
  sectionKey: StrataSectionKey;
  content: string;
  contentJson?: Record<string, unknown> | null;
}> {
  const updates: Array<{
    sectionKey: StrataSectionKey;
    content: string;
    contentJson?: Record<string, unknown> | null;
  }> = [
    {
      sectionKey: "refined_text",
      content: args.refinedText,
      contentJson: {
        ...((args.existing.refined_text.contentJson ?? {}) as Record<string, unknown>),
        generatedTitle: args.refinedTitle,
      },
    },
  ];

  const shouldOverwriteElaborated =
    args.overwriteElaborated === true || isGeneratedSectionMissing(args.existing.elaborated);

  if (shouldOverwriteElaborated) {
    updates.push({
      sectionKey: "elaborated",
      content: args.elaborated,
      contentJson: args.elaboratedArtifacts ?? null,
    });
  }

  return updates;
}

export function sectionHeadingMap(): Record<StrataSectionKey, string> {
  return {
    raw_text: sectionTitleFromKey("raw_text"),
    refined_text: sectionTitleFromKey("refined_text"),
    elaborated: sectionTitleFromKey("elaborated"),
    design_instructions: sectionTitleFromKey("design_instructions"),
    ai_instructions: sectionTitleFromKey("ai_instructions"),
  };
}
