-- Migration: Arcadia encrypted draft autosave on threads
-- Purpose:
-- - arcadia_draft_ciphertext: client-encrypted draft payload (self-describing enc:v1:... format).
-- - arcadia_draft_updated_at: last successful autosave time for restore and staleness checks.
--
-- Notes:
-- - Both columns are nullable; NULL ciphertext means no saved draft.
-- - Plaintext never stored here; server may decrypt only for authorized flows.

ALTER TABLE threads
ADD COLUMN IF NOT EXISTS arcadia_draft_ciphertext text;

ALTER TABLE threads
ADD COLUMN IF NOT EXISTS arcadia_draft_updated_at timestamptz;

COMMENT ON COLUMN threads.arcadia_draft_ciphertext IS 'Client-encrypted Arcadia composer draft for this thread (opaque ciphertext string).';
COMMENT ON COLUMN threads.arcadia_draft_updated_at IS 'Timestamp of the last persisted Arcadia draft for this thread.';
