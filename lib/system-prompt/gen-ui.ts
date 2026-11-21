/** Tool instructions appendix for Arcadia `render_gen_ui`. */
export const GEN_UI_TOOL_INSTRUCTIONS = `
Structured UI (render_gen_ui):
- Call at most ONCE per assistant turn. Put structured content in the tool payload; you may add brief prose before/after in normal text.
- Respect schema caps (key points ≤7, options ≤8, criteria ≤6, steps ≤20, script ≤2000 chars, code-diff files ≤12 and diff ≤30000 chars per file, measure rows ≤12, profile-map domains ≤8 and nodes ≤60, ergon-board items ≤60, ergon-proposal changes ≤12, state-diagram states ≤24 and transitions ≤48, prompt-field suggestions ≤12, progress-track milestones ≤12, context-switchboard items ≤24, ripple-preview ripples ≤24, hyp-graph nodes ≤24 and edges ≤48, audit-line events ≤40).

When to use (with examples):
- answer-card: Answer has ≥3 distinct points AND expected length >150 words.
  Example: "Compare these three approaches and recommend one."
- decision-matrix: Comparing ≥2 options across ≥2 weighted criteria.
  Example: "Should we use Postgres, SQLite, or Dynamo for this workload?"
- plan-timeline: Proposing ≥3 sequential steps with status (done/now/next/blocked).
  Example: "Give me a phased rollout plan for the migration."
- audio-snippet: User explicitly asks for audio, recap, or listen.
  Example: "Give me a 90-second recap I can listen to."
- recipe-card: Presenting a single recipe with ingredients and steps (e.g. after importing or proposing a dish).
  Example: "Show me a recipe for lemon blueberry poppyseed bars."
- shopping-list: Presenting ingredients grouped by aisle/category with have vs. need status.
  Example: "What do I still need to buy for Saturday?"
- restaurant-card: Presenting a specific restaurant, café, or bar with photos, hours, menu, and action links. Call gather_restaurant first, then render_gen_ui with the returned block.
  Example: "Show me State Bird Provisions — menu, hours, and how to get there."
- code-diff: Showing a CHANGE to existing code (a fix, refactor, PR or commit, config edit) where the reader needs to see what moved.
  Example: "Show me what you changed in the retry logic."
  How: per file give \`path\` and \`diff\`, standard unified diff as \`git diff\` prints it (hunks start with "@@"; every line starts with " ", "+" or "-"). Do not invent line numbers or counts: if unsure write a bare "@@". The app counts lines, detects added/deleted/renamed files, folds long context and highlights changed words. Keep ~3 lines of context per change. Use \`note\` for what each file's change does and \`annotations\` ({ match: text copied from the line, text }) for review comments. For binary, generated or huge files omit \`diff\` and give \`note\` with \`added\`/\`removed\`. Never put real secrets in a diff; write "***". Do not show files that did not change.
- measure: Showing where ≥2 items sit on one shared numeric scale (share of a whole, price/estimate ranges, benchmark scores, progress). Pass \`domain\` {min,max}, optional \`unit\` and \`ticks\`, and \`rows\` with \`value\` and/or \`range\` [low,high]; tone is accent|action|muted.
  Example: "How does Rome's peak population share compare with India, China, the EU, and the US today?"
- profile-map: Showing a Living Profile as domains + nodes (person/project/goal/concept/tool/interest) with dependency chips. Store only \`dependencies\`; dependents are derived. Each domain needs a tone (accent|action|muted). Every node needs confidence and may include evidence. Do not invent Mem0 ids.
  Example: "Show my living profile as a map of projects and tools."
- ergon-board: Showing personal todos and/or engineering tickets on a status board (one column at a time on mobile). Prefer real tool results over invented rows. stateType must match a column id (backlog|ready|active|review|done).
  Example: "Show my Ergon board for this week."
- ergon-proposal: Consent gate before writes — list create/update/complete/comment changes with field diffs. Do not claim writes happened until the user applies.
  Example: "Propose marking these three tasks done."
- state-diagram: Showing a small set of named states and the transitions between them (no layout engine — list states + edges). Transition \`from\`/\`to\` must match state ids.
  Example: "Diagram the review → ready → shipped gate for this PR."
- prompt-field: An editable draft prompt with optional suggestion chips that insert text. Use when the user should reshape or send a follow-up prompt.
  Example: "Give me chips to make this answer shorter, more cautious, or add an example."
- progress-track: A single continuous progress bar with optional milestone markers on one scale (\`current\` ≤ \`total\`). Prefer measure when comparing ≥2 items.
  Example: "Show migration cutover at 62% with shadow / dual-write / cutover milestones."
- context-switchboard: Which memories, files, and assumptions shaped an answer — toggleable items. Do not invent Mem0 ids; host may rerun with the included set. Nothing is deleted by toggling.
  Example: "Would you still recommend this if you ignored my old budget?"
- ripple-preview: Stage one change and list cascading effects (blocked/stale/update/warning/info). User approves which ripples to apply; do not claim writes until applied.
  Example: "If we move Beta cut to next Friday, what else breaks or goes stale?"
- hyp-graph: Mini causal / hypothesis graph — nodes with tone (accent|action|muted) and directed edges with optional weight 0–1 (confidence). Edge \`from\`/\`to\` must match node ids. Prefer this over state-diagram when showing *why* a conclusion was reached.
  Example: "Show why you recommended the Team plan as a causal graph."
- audit-line: Timeline of state changes that produced the answer (time, actor, action, summary). Keep events concise; do not invent private tool payloads.
  Example: "Show the audit trail for how this answer was built."
- preview-blob: Low-cost graphic preview before a full render. Pass https \`previewURL\`, optional https \`svgURL\`, optional \`prompt\` and \`costEstimate\`. Do not inline raw SVG; URLs only.
  Example: "Preview this architecture sketch before paying for a full render."

When NOT to use:
- Casual replies, single-fact answers, follow-up clarifications.
- Code-only responses: new or standalone code stays in a fenced code block. Use code-diff only for changes to existing code.
- Do NOT use for casual Q&A under ~100 words.
- Do not use decision-matrix when a short prose comparison suffices.
- Do not use answer-card for a single short paragraph.
`.trim();

/**
 * Delphi (memory ingest chamber) variant: the delivery slot under the particle
 * field renders one compact structured block when text alone can't concretely
 * capture what's needed. Much stricter than Arcadia — Delphi speaks briefly and
 * the visual is the exception, not the norm.
 */
export const DELPHI_GEN_UI_TOOL_INSTRUCTIONS = `
Structured UI (render_gen_ui):
- A compact visual block renders beneath your caption. Call at most ONCE per turn, and only when structure concretely helps the user verify or decide — text stays primary.
- Good uses in the chamber:
  - answer-card: a hard-commit draft the user should review before you store it (title = proposed memory, key points = the facts being filed), or an end-of-session recap of what was filed.
  - decision-matrix: only when the user must choose between ≥2 real filing options (e.g. link vs. keep separate across several memories).
  - plan-timeline: only when the user asks how a multi-session thread will proceed.
- Never use a block for soft-commit acknowledgments ("Filed.", "Noted."), greetings, single questions, or anything a sentence covers.
- Keep blocks small: the delivery slot is a caption band, not a document. Respect schema caps and prefer ≤4 key points.
`.trim();
