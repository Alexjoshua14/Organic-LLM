export const STRATA_PROMPT_RUBRIC = `
Score prompts on a 1-10 scale across:
1) Constraint fidelity: preserves Raw Text and protected instruction sections.
2) Output quality: Refined Text is near 1:1 cleanup; Elaborated adds clarity without fabrication.
3) Structural reliability: produces valid structured output with clear section boundaries.
4) Update safety: updates existing generated sections without destructive resets.
5) Instruction binding: correctly applies Design Instructions and AI Instructions context.

A 9/10+ prompt must:
- Explicitly forbid changing Raw Text unless requested.
- Explicitly forbid changing Design Instructions and AI Instructions unless requested.
- Require near 1:1 normalization for Refined Text.
- Require Elaborated output to stay grounded in source content.
- Produce deterministic, parseable JSON fields.
`.trim();
