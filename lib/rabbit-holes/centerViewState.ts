/**
 * Shared center-column view state for Rabbit Hole explorer (desktop + mobile).
 */
export type CenterViewState =
  | { kind: "loading_previous_session" }
  | { kind: "empty" }
  | { kind: "article_loaded"; nodeId: string }
  | { kind: "generating_new_node"; variant: "initial" | "branch" }
  | { kind: "loading_source_analysis" }
  | { kind: "viewing_source_analysis"; sourceId: string };

export type RabbitHoleCenterViewInput = {
  loadingPrevious: boolean;
  isAnalyzingSource: boolean;
  selectedSourceId: string | null;
  hasSourceAnalysis: boolean;
  activeNode: { id: string; articleHtml?: string | null } | null;
  /** True when the active node continues an existing path rather than opening the session. */
  isBranch: boolean;
};

/**
 * A node without article HTML is still generating (or waiting to resume).
 * Returning `article_loaded` for that node blanks the center, because the article
 * view only renders when `articleHtml` is present.
 */
export function resolveRabbitHoleCenterView(input: RabbitHoleCenterViewInput): CenterViewState {
  if (input.loadingPrevious) return { kind: "loading_previous_session" };
  if (input.isAnalyzingSource) return { kind: "loading_source_analysis" };

  if (input.selectedSourceId && input.hasSourceAnalysis) {
    return { kind: "viewing_source_analysis", sourceId: input.selectedSourceId };
  }

  if (input.activeNode && !input.activeNode.articleHtml?.trim()) {
    return {
      kind: "generating_new_node",
      variant: input.isBranch ? "branch" : "initial",
    };
  }

  if (input.activeNode) return { kind: "article_loaded", nodeId: input.activeNode.id };

  return { kind: "empty" };
}
