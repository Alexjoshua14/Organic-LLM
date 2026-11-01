/** Public implementation snapshot; examples below are invented, never copied from user threads. */
export const MULTIAGENT_SOURCE_REVISION = "0cec97fa8af959202b1d69e1389f5cedaec98603";
export const sourceHref = (path: string) =>
  `https://github.com/Alexjoshua14/Organic-LLM/blob/${MULTIAGENT_SOURCE_REVISION}/${path}`;

export const CHAPTERS = [
  ["heartbeat", "The heartbeat"],
  ["threads", "The thread"],
  ["context", "The handoff"],
  ["specialists", "The specialists"],
  ["presence", "The presence"],
] as const;

export const HEARTBEAT_SCENARIOS = [
  {
    id: "unchanged",
    label: "Nothing changed",
    status: "unchanged",
    jev: false,
    notify: false,
    before: "Lyra is researching. No new outcome.",
    after: "Lyra is researching. No new outcome.",
    title: "Same digest. No model call.",
    detail:
      "The current snapshot matches the last evaluated digest. The server returns early, before claiming an evaluation or calling Jev.",
  },
  {
    id: "quiet",
    label: "Small update",
    status: "quiet",
    jev: true,
    notify: false,
    before: "Reed is checking the parser.",
    after: "Reed is still checking the parser; the status wording changed.",
    title: "Changed does not always mean useful.",
    detail:
      "In this illustrative outcome, Jev judges the change unimportant. The evaluated digest advances, while the last-notified baseline stays put. Small changes can accumulate into something worth reporting.",
  },
  {
    id: "done",
    label: "Work completed",
    status: "notable",
    jev: true,
    notify: true,
    before: "Lyra is comparing the sources.",
    after: "Lyra finished. Findings and supporting evidence are ready.",
    title: "A result worth bringing back.",
    detail:
      "Jev can recognize a new outcome as actionable. A system notice records the before-and-after snapshots, an orchestrator reply is queued, and the notification baseline advances.",
  },
  {
    id: "blocked",
    label: "Decision needed",
    status: "notable",
    jev: true,
    notify: true,
    before: "Reed is drafting the implementation.",
    after: "Reed is blocked: which export format should the implementation support?",
    title: "A question should not disappear in a child thread.",
    detail:
      "A blocker, stalled task or request for a decision can be notable. The parent receives the change so it can ask the user or take the next authorized step.",
  },
  {
    id: "direct",
    label: "User steers a worker",
    status: "notable",
    jev: true,
    notify: true,
    before: "Lyra is investigating the original question.",
    after: "The user asks Lyra directly to include contradictory evidence.",
    title: "The conversation can branch without losing the plot.",
    detail:
      "A new request inside a specialist thread can matter to the orchestrator. Jev compares the compact snapshots and can bring that change back into the main conversation.",
  },
] as const;

export const CONTEXT_ITEMS = [
  {
    id: "words",
    kind: "user_message",
    label: "The user's exact constraint",
    ref: "msg:example-01",
    text: "The export must preserve streamed chunks in their original order.",
    note: "Exact user quotations are checked against the owned source message.",
  },
  {
    id: "evidence",
    kind: "live_subagent_output",
    label: "Lyra's latest finding",
    ref: "out:agent-researcher",
    text: "The source describes ordered delivery. Test partial chunks and an interrupted stream.",
    note: "A live reference resolves the latest output at dispatch time, rather than freezing an old result.",
  },
  {
    id: "rubric",
    kind: "note",
    label: "A reusable review rubric",
    ref: "bundle:example-review",
    text: "Return a minimal diff, name edge cases, and include reproducible verification steps.",
    note: "Standing instructions and reusable items stay on the private worktable until selected.",
  },
  {
    id: "repo",
    kind: "note",
    label: "Repository context",
    ref: "connector:github",
    text: "Example project: a TypeScript streaming exporter. Keep the public interface stable.",
    note: "Shorthand expands a selected connector slice. Connected context is explicit, not shared ambient access.",
  },
] as const;

export const SPECIALISTS = [
  {
    name: "Reed",
    role: "Implementation",
    kind: "Fixed persona",
    glyph: "R",
    tools: ["Web search", "GitHub context", "Chronos"],
    description:
      "Concrete code, minimal diffs, edge cases and verification. Reed works from the interfaces and constraints in the brief.",
    detail:
      "GitHub profile and repository context arrive through selected connector notes. Chronos provides owner-gated, read-only repository inspection; this is not a general GitHub write tool.",
    source: "lib/llm/subagents/hard-set/agents/coder.ts",
  },
  {
    name: "Lyra",
    role: "Research",
    kind: "Fixed persona",
    glyph: "L",
    tools: ["Exa", "Firecrawl", "Docling", "Evidence ledger"],
    description:
      "Primary-source investigation with an inspectable evidence trail. Findings, quotations and interpretations remain distinguishable.",
    detail:
      "Search and read with Exa; scrape, map and crawl with Firecrawl; parse documents with Docling. A thread-scoped ledger preserves sources, claims and contradictions. Provider access depends on configuration.",
    source: "lib/llm/subagents/research/README.md",
  },
  {
    name: "Archer",
    role: "Architecture",
    kind: "Fixed persona",
    glyph: "A",
    tools: ["Memory", "Architecture briefs"],
    description:
      "Components, data flow, interfaces and trade-offs. Archer turns an open design problem into a draft someone can build from.",
    detail:
      "A code-defined architecture persona with memory enabled. Infrastructure preferences can be attached explicitly. Implementation is handed back for routing to Reed.",
    source: "lib/llm/subagents/hard-set/agents/architect.ts",
  },
  {
    name: "Mira",
    role: "Planning",
    kind: "Fixed persona",
    glyph: "M",
    tools: ["Ergon docs", "Tickets", "Agent runs"],
    description:
      "Ergon's representative inside Organic. Mira connects decisions, open questions and existing work to a concrete plan.",
    detail:
      "Owner-gated Ergon tools read planning context. A named-issue agent run requires an explicit request; Mira does not silently turn a plan into an external action.",
    source: "lib/llm/subagents/hard-set/agents/planner.ts",
  },
  {
    name: "Cass",
    role: "Writing",
    kind: "Roster role",
    glyph: "C",
    tools: ["Authored brief", "Selected context"],
    description: "Turns decisions and evidence into clear documents and synthesis.",
    detail:
      "Cass is a dispatchable writer slot. Unlike the four fixed personas, this role is defined by the roster and worker instructions rather than its own hard-set agent file.",
    source: "lib/arcadia/multitask/demo-roster.ts",
  },
  {
    name: "Vesper",
    role: "Critique",
    kind: "Roster role",
    glyph: "V",
    tools: ["Authored brief", "Selected context"],
    description:
      "Pressure-tests assumptions, examines failure modes and challenges a proposed approach.",
    detail:
      "Vesper is a dispatchable critic slot. Reviews are bounded assignments; the cost policy explicitly discourages unsolicited judging or repeated review cycles.",
    source: "lib/arcadia/multitask/demo-roster.ts",
  },
] as const;
