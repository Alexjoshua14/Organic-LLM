/**
 * Composer "use memories" default resolution, shared by `CoreInput` and tests.
 *
 * The memories toggle persists per-surface in localStorage. The Memory ingest
 * chamber scopes its own key (so it does not share state with main chat) and
 * defaults memory retrieval ON, since talking to the Memory without reading the
 * corpus makes no sense.
 */

/** Scoped localStorage key for the Memory ingest chamber's memories toggle. */
export const MEMORY_INGEST_MEMORIES_STORAGE_KEY = "organic-llm-memories-delphi";

/** The Memory ingest chamber enables memory retrieval by default. */
export const MEMORY_INGEST_DEFAULT_MEMORIES_ON = true;

/**
 * Resolve the initial memories-toggle state for a composer surface.
 * A stored pref wins (`"true"`/`"false"`); absent any stored pref, fall back to
 * the surface default (e.g. the chamber defaults on, main chat defaults off).
 */
export function resolveInitialMemoriesOn(
  storedValue: string | null,
  defaultMemoriesOn: boolean
): boolean {
  if (storedValue === "true") return true;
  if (storedValue === "false") return false;

  return defaultMemoriesOn;
}
