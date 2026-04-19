import type { StrataSectionKey } from "@/lib/schemas/strata";

export type ActionStatusState = "idle" | "loading" | "completed" | "error";

export type StrataMainTab = "source" | "synthesis" | "settings";

export type SourceSaveState = "idle" | "saving" | "saved" | "error";

export type SourceDocLayout = "raw" | "refined" | "split";

export const NOTEBOOK_FOCUS_CLASS =
  "focus:bg-[linear-gradient(to_bottom,transparent_31px,rgba(120,120,120,0.12)_32px)] focus:bg-size-[100%_32px]";

export const STRATA_MAIN_TAB_DEFS: { id: StrataMainTab; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "synthesis", label: "Synthesis" },
  { id: "settings", label: "Settings" },
];

export function getSectionLabels(): Record<StrataSectionKey, { title: string; subtitle: string }> {
  return {
    raw_text: {
      title: "Raw Text",
      subtitle: "Your source input. AI does not rewrite this section.",
    },
    refined_text: {
      title: "Refined Text",
      subtitle: "Near 1:1 cleanup from Raw Text with formatting consistency.",
    },
    elaborated: {
      title: "Elaborated",
      subtitle: "Expanded representation using the refined content.",
    },
    design_instructions: {
      title: "Design Instructions",
      subtitle: "Visual and structure guidance used by Strata generation.",
    },
    ai_instructions: {
      title: "AI Instructions",
      subtitle: "Behavior instructions for the Strata generation pipeline.",
    },
  };
}

export function buildRefinedSectionTitle(refinedText: string): string {
  const cleaned = refinedText.replace(/\s+/g, " ").trim();

  if (cleaned.length === 0) return "Refined Draft";

  return cleaned.split(" ").filter(Boolean).slice(0, 8).join(" ");
}
