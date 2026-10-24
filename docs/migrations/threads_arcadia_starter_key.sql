-- Migration: Arcadia starter prompt key on threads
-- Purpose:
-- - arcadia_starter_key: stable key (e.g. scribe:stitch-this-together) resolved server-side
--   into system prompt priming for the thread.
--
-- Notes:
-- - Nullable; NULL means no starter priming.
-- - Writable only while the thread is empty (enforced in application code).

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS arcadia_starter_key text;

COMMENT ON COLUMN threads.arcadia_starter_key IS
  'Stable Arcadia starter key (e.g. scribe:stitch-this-together); resolved server-side into system prompt.';
