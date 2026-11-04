-- Migration: per-scope CoreInput settings snapshots
-- One row per (owner, scope): the composer settings last chosen in that thread or area,
-- bit-packed into `bits` (see lib/core-input/snapshot-codec.ts for the layout).
-- The client caches these locally and syncs changes here; the app caps rows per owner at 4096.
-- Apply in Supabase SQL editor or your migration pipeline. Not auto-applied by the app.
-- Until applied, the sync route reports the table missing and clients stay local-only.

CREATE TABLE IF NOT EXISTS core_input_snapshots (
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  -- Full scope key (e.g. `arcadia:thread:<uuid>`, `aion`). Clients index by a hash of this;
  -- storing the key itself keeps server lookups collision-free.
  scope_key TEXT NOT NULL CHECK (char_length(scope_key) BETWEEN 1 AND 200),
  -- Packed settings, always below 2^53 so it round-trips through JSON numbers.
  bits BIGINT NOT NULL CHECK (bits > 0 AND bits < 9007199254740992),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_core_input_snapshots_owner_updated
  ON core_input_snapshots(owner_id, updated_at DESC);

ALTER TABLE core_input_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own core input snapshots"
  ON core_input_snapshots FOR SELECT
  USING (owner_id = current_profile_id());

CREATE POLICY "Users can insert their own core input snapshots"
  ON core_input_snapshots FOR INSERT
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can update their own core input snapshots"
  ON core_input_snapshots FOR UPDATE
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can delete their own core input snapshots"
  ON core_input_snapshots FOR DELETE
  USING (owner_id = current_profile_id());
