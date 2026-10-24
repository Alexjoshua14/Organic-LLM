-- Migration: Create strata_pages and strata_sections tables for Strata prototype
-- Stores each Strata page plus one row per section for section-level persistence.

CREATE TABLE IF NOT EXISTS strata_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Strata page',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strata_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES strata_pages(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL CHECK (
    section_key IN (
      'raw_text',
      'refined_text',
      'elaborated',
      'design_instructions',
      'ai_instructions'
    )
  ),
  content TEXT NOT NULL DEFAULT '',
  content_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_strata_pages_owner_id ON strata_pages(owner_id);
CREATE INDEX IF NOT EXISTS idx_strata_pages_updated_at ON strata_pages(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_strata_sections_page_id ON strata_sections(page_id);
CREATE INDEX IF NOT EXISTS idx_strata_sections_page_key ON strata_sections(page_id, section_key);
CREATE INDEX IF NOT EXISTS idx_strata_sections_updated_at ON strata_sections(updated_at DESC);

ALTER TABLE strata_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE strata_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own strata pages"
  ON strata_pages FOR SELECT
  USING (owner_id = current_profile_id());

CREATE POLICY "Users can insert their own strata pages"
  ON strata_pages FOR INSERT
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can update their own strata pages"
  ON strata_pages FOR UPDATE
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can delete their own strata pages"
  ON strata_pages FOR DELETE
  USING (owner_id = current_profile_id());

CREATE POLICY "Users can view sections from their own strata pages"
  ON strata_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_sections.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can insert sections into their own strata pages"
  ON strata_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_sections.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can update sections in their own strata pages"
  ON strata_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_sections.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_sections.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can delete sections from their own strata pages"
  ON strata_sections FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM strata_pages
      WHERE strata_pages.id = strata_sections.page_id
      AND strata_pages.owner_id = current_profile_id()
    )
  );

CREATE OR REPLACE FUNCTION update_strata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_strata_pages_updated_at
  BEFORE UPDATE ON strata_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_strata_updated_at();

CREATE TRIGGER update_strata_sections_updated_at
  BEFORE UPDATE ON strata_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_strata_updated_at();

COMMENT ON TABLE strata_pages IS 'Top-level Strata prototype documents.';
COMMENT ON TABLE strata_sections IS 'Section-level content rows for each Strata page.';
