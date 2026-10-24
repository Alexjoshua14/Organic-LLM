-- Migration: Yjs-backed Strata notepad storage.
-- Adds:
--   * strata_note_snapshots — one compacted CRDT snapshot per (page_id, note_id), with the
--     server state vector and a monotonic version counter.
--   * strata_note_updates    — append-only log of incremental Yjs updates between snapshots.
--
-- The note_id is the same UUID used for the corresponding StrataTextSourceNode.id stored inside
-- strata_sections.raw_text.contentJson.textSources. Foreign-keying through page_id is sufficient;
-- there is no referential integrity for note_id because text sources are JSON-blob entries.

CREATE TABLE IF NOT EXISTS strata_note_snapshots (
  page_id UUID NOT NULL REFERENCES strata_pages(id) ON DELETE CASCADE,
  note_id UUID NOT NULL,
  snapshot BYTEA NOT NULL,
  state_vector BYTEA NOT NULL,
  version INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_id, note_id)
);

CREATE TABLE IF NOT EXISTS strata_note_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES strata_pages(id) ON DELETE CASCADE,
  note_id UUID NOT NULL,
  update BYTEA NOT NULL,
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strata_note_updates_page_note_created
  ON strata_note_updates (page_id, note_id, created_at);

CREATE INDEX IF NOT EXISTS idx_strata_note_snapshots_updated_at
  ON strata_note_snapshots (updated_at DESC);

ALTER TABLE strata_note_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE strata_note_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own strata note snapshots"
  ON strata_note_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_snapshots.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can insert strata note snapshots for their pages"
  ON strata_note_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_snapshots.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can update strata note snapshots for their pages"
  ON strata_note_snapshots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_snapshots.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_snapshots.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can delete strata note snapshots for their pages"
  ON strata_note_snapshots FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_snapshots.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can view their own strata note updates"
  ON strata_note_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_updates.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can insert strata note updates for their pages"
  ON strata_note_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_updates.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can delete strata note updates for their pages"
  ON strata_note_updates FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_note_updates.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE TRIGGER update_strata_note_snapshots_updated_at
  BEFORE UPDATE ON strata_note_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_strata_updated_at();

COMMENT ON TABLE strata_note_snapshots IS 'Compacted Yjs CRDT snapshots for Strata notepad notes (one row per active note).';
COMMENT ON TABLE strata_note_updates IS 'Append-only log of incremental Yjs updates applied between snapshot compactions.';
