-- Arcadia orchestrator worktable (COA-258).
-- Apply explicitly via the SQL editor or migration pipeline; not auto-applied.
-- Requires threads_subagent_threads.sql. Until this runs, the worktable tool reports
-- "unavailable" and dispatch_subagent still sends context passed inline.
--
-- One encrypted JSON document per orchestrator thread: the context bundles the orchestrator
-- composes for its subagents, plus the count of automatic (heartbeat) dispatches since the
-- user last spoke. Writes are optimistic: the application updates only when the stored
-- ciphertext still matches what it read.

BEGIN;

ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS subagent_worktable text;

COMMENT ON COLUMN public.threads.subagent_worktable IS
  'Encrypted orchestrator worktable (context bundles for subagents). Private to the orchestrator thread; subagents see only what a dispatch sends.';

COMMIT;
