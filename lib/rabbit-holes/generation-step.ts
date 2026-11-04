import type { GenerationStep } from "@/lib/schemas/rabbitHoleSchemas";

/** First incomplete generation phase for a node that still needs an article. */
export function incompleteGenerationStep(node: {
  sources?: readonly unknown[] | null;
  articleHtml?: string | null;
  branchSuggestions?: readonly unknown[] | null;
}): GenerationStep | null {
  if (!node.sources?.length) return "sources";
  if (!node.articleHtml?.trim()) return "article";
  if (!node.branchSuggestions?.length) return "branch_suggestions";

  return null;
}
