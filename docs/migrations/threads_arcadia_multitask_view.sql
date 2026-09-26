-- Migration: Arcadia multitask (multiagent) view flag on threads
-- Purpose:
-- - arcadia_multitask_view: per-thread on/off for the multitask dashboard.
--   Default false = normal chat. Additive only; no drops/rewrites.
--
-- Notes:
-- - Non-sensitive boolean metadata (safe in thread list / sync payloads with thread id).
-- - Application code refuses toggles while threads.active_stream_id is set.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS arcadia_multitask_view boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN threads.arcadia_multitask_view IS
  'Arcadia multitask/multiagent dashboard on for this thread. Default false (normal chat).';
