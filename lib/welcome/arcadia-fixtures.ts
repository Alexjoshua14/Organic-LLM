/** Side-project prompt where a radial map beats a wall of advice. */
export const WELCOME_ARCADIA_USER_PROMPT = "Why does this idea keep losing momentum?";

/**
 * Idea lifecycle map — valid Mermaid mindmap (4-space indent per level).
 */
export const WELCOME_ARCADIA_MERMAID = `mindmap
    root((Idea))
        Spark
            Why now?
            Core pull
        Scope
            Features
            Paths
        Blur
            MVP?
            Audience?
        Friction
            Decisions
            Energy
        Drift
            New idea
            Restart`;

export const WELCOME_ARCADIA_TOOL_NAME = "make_mermaid_diagram";

export const WELCOME_ARCADIA_TOOL_STATUS = {
  planning: "Planning Mermaid diagram…",
  generating: "Generating Mermaid code…",
  validating: "Validating Mermaid syntax…",
} as const;

export const WELCOME_ARCADIA_PLANNING_HINT = "Mapping the branches…";
