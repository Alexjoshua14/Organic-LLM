-- Migration: Introspection guided experience columns on threads
-- Run in Supabase SQL editor or via your migration pipeline.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS introspection_config_ciphertext TEXT NULL,
  ADD COLUMN IF NOT EXISTS introspection_guided_state_ciphertext TEXT NULL,
  ADD COLUMN IF NOT EXISTS introspection_bootstrap_nonce TEXT NULL;

COMMENT ON COLUMN threads.introspection_config_ciphertext IS
  'Server-encrypted JSON (enc:v1:...) with hidden orchestration config; never sent to client.';

COMMENT ON COLUMN threads.introspection_guided_state_ciphertext IS
  'Server-encrypted JSON public guided UI state (overview, breadcrumb, step).';

COMMENT ON COLUMN threads.introspection_bootstrap_nonce IS
  'One-time bootstrap nonce from Introspection; used for replay protection.';

CREATE UNIQUE INDEX IF NOT EXISTS threads_introspection_bootstrap_nonce_uidx
  ON threads (introspection_bootstrap_nonce)
  WHERE introspection_bootstrap_nonce IS NOT NULL;
