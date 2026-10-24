import type { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";

/** Shared by sandbox title scenario and unit tests so behavior stays in one place. */
export function normalizeRabbitHoleTitleScenarioSession(
  raw: { title: string | null },
  seed: RabbitHoleSessionMetadata
): RabbitHoleSessionMetadata | null {
  return raw.title != null ? { ...seed, rootTitle: raw.title } : null;
}
