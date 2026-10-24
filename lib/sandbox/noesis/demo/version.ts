/**
 * Content-addressed versioning for demo runs.
 *
 * A demo "version" is the SHA-256 of every input that affects the generated
 * conversation. Identical inputs → identical hash, so reverting a prompt to a
 * previous version (or re-entering matching text) reuses that version's cached demo
 * thread instead of paying to regenerate it.
 */
import "server-only";

import { createHash } from "crypto";

export type DemoVersionInput = {
  /** The (possibly edited) spark system prompt under test. */
  systemPrompt: string;
  /** The preset opening user message. */
  kickoff: string;
  /** Model id used for the run. */
  model: string;
  /** Number of spark reply cycles. */
  cycles: number;
  /** NPC persona version tag (bumping it invalidates all cached demos). */
  npcPersonaVersion: string;
};

/** Stable cache key for a demo run. Mirrors the hashing style in `lib/memory/memory-search-cache.ts`. */
export function computeDemoVersionHash(input: DemoVersionInput): string {
  const canonical = JSON.stringify({
    systemPrompt: input.systemPrompt.trim(),
    kickoff: input.kickoff.trim(),
    model: input.model,
    cycles: input.cycles,
    npc: input.npcPersonaVersion,
  });

  return createHash("sha256").update(canonical).digest("hex");
}
