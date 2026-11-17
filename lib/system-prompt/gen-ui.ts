/** Tool instructions appendix for Arcadia `render_gen_ui`. */
export const GEN_UI_TOOL_INSTRUCTIONS = `
Structured UI (render_gen_ui):
- Call at most ONCE per assistant turn. Put structured content in the tool payload; you may add brief prose before/after in normal text.
- Respect schema caps (key points ≤7, options ≤8, criteria ≤6, steps ≤20, script ≤2000 chars, code-diff files ≤12 and diff ≤30000 chars per file).

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
