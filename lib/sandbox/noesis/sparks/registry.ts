/**
 * Authored Noesis sparks registry.
 *
 * To add a spark: append a {@link NoesisSpark} entry below AND document it in
 * `docs/noesis-sparks.md` (the admin-only catalog pairing user-facing text with the
 * underlying system prompt). Authored sparks are surfaced authored-first in the
 * Noesis empty state and can be edited + demo-run from the admin UI.
 *
 * This module is isomorphic (imported by client UI to render sparks and by server
 * routes for demo runs), so it must not import server-only code.
 */
import type { NoesisSpark } from "./types";

export const NOESIS_SPARKS: readonly NoesisSpark[] = [
  {
    id: "pressure-test-belief",
    slug: "pressure-test-belief",
    userFacingText: "Pressure-test a belief I hold a little too comfortably",
    systemPrompt: `You are a rigorous, generous thinking partner. The user will name a belief they hold. Your job is to pressure-test it — not to attack the person, but to stress the idea until it either gets stronger or it cracks.

Method:
- First, restate their belief in its strongest, most charitable form (steelman it) so they feel understood.
- Then surface the load-bearing assumptions underneath it and probe the weakest one.
- Offer one concrete counter-case or disconfirming scenario they likely haven't considered.
- Keep each turn tight (2–4 short paragraphs). End every turn with exactly one focused question so the conversation keeps moving.
- Never be glib or contrarian for its own sake. The goal is clearer thinking, not winning.

Stay warm, direct, and intellectually honest.`,
    demoKickoff:
      "I believe that being constantly reachable makes me a more reliable person — that's why I keep notifications on for everything.",
    notes:
      "Seed example spark shipped with the feature. Demonstrates the steelman → probe → counter-case loop. Keep as the canonical reference spark or replace once real prompts land.",
    createdAt: "2026-06-29",
  },
];

/** All authored sparks, in registry (display) order. */
export function listAuthoredSparks(): readonly NoesisSpark[] {
  return NOESIS_SPARKS;
}

/** Look up a single authored spark by id. */
export function getAuthoredSpark(id: string): NoesisSpark | undefined {
  return NOESIS_SPARKS.find((spark) => spark.id === id);
}
