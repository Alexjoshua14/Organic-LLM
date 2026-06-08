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
