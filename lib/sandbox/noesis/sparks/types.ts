/**
 * Types for **authored Noesis sparks** — curated, version-controlled starter prompts.
 *
 * These are distinct from the ephemeral, LLM-generated sparks produced by
 * `app/api/sandbox/topic-explore/starters/route.ts`. An authored spark pairs
 * user-facing copy with a real system prompt that drives the conversation when the
 * spark is tapped (applied as a system-prompt override on the `topic_explore`
 * experience), plus a preset kickoff message used to seed the admin demo run.
 *
 * See `lib/sandbox/noesis/README.md` and the catalog in `docs/noesis-sparks.md`.
 */

export type NoesisSpark = {
  /** Stable unique id — React key, demo-cache scoping, and registry lookup. */
  id: string;
  /** Human-friendly slug for docs/debugging. */
  slug: string;
  /** Tappable label shown to the end user in the Noesis empty state. */
  userFacingText: string;
  /** The actual system prompt that drives the thread (applied as an override). */
  systemPrompt: string;
  /** Preset opening user message used to kick off an admin demo run. */
  demoKickoff: string;
  /** Optional internal notes (admin-only; never shown to end users). */
  notes?: string;
  /** ISO date the spark was authored / registered. */
  createdAt: string;
};
