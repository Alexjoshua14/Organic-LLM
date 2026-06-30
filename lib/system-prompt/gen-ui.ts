/** Tool instructions appendix for Arcadia `render_gen_ui`. */
export const GEN_UI_TOOL_INSTRUCTIONS = `
Structured UI (render_gen_ui):
- Call at most ONCE per assistant turn. Put structured content in the tool payload; you may add brief prose before/after in normal text.
- Respect schema caps (key points ≤7, options ≤8, criteria ≤6, steps ≤20, script ≤2000 chars).

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

When NOT to use:
- Casual replies, single-fact answers, code-only responses, follow-up clarifications.
- Do NOT use for casual Q&A under ~100 words.
- Do not use decision-matrix when a short prose comparison suffices.
- Do not use answer-card for a single short paragraph.
`.trim();
