/**
 * Shared constants for the Memory ingest (Delphi) chamber.
 *
 * Memory ingest sessions live in their own space: they are tagged with the
 * {@link MEMORY_INGEST_FEATURE} thread `feature` so they stay out of the main
 * chat sidebar, and re-entering the chamber is recency-aware (see the entry
 * page at `app/sandbox/prototypes/memory-ingest/page.tsx`).
 *
 * This module is intentionally dependency-free so it is safe to import from
 * both client components (the sidebar filter) and server code (the entry page,
 * the create action, the data layer).
 */

/** Thread `feature` tag identifying a Memory ingest session. */
export const MEMORY_INGEST_FEATURE = "memory-ingest";

/**
 * Re-entering the chamber within this window resumes the most recent Memory
 * ingest session (you drop back into the same conversation with the Memory).
 * Past it — or with no prior session — a fresh session is started, on the
 * assumption that after a real gap the user wants a clean line of communication.
 * ~1 hour ≈ "still in the same sitting."
 */
export const MEMORY_INGEST_RESUME_WINDOW_MS = 60 * 60 * 1000;
