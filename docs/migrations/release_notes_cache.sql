-- Global release-notes cache keyed by git SHA pair (from_sha, to_sha).
-- One row per comparison, shared by every user. Not keyed by user id.
--
-- Reads: signed-in clients (authenticated JWT) may SELECT.
-- Writes: service role only (no INSERT/UPDATE/DELETE policies for authenticated).
--
-- Apply once in the Supabase SQL editor (or via psql), then optionally:
--   bun run supabase:types

CREATE TABLE IF NOT EXISTS public.release_notes_cache (
  from_sha      text        NOT NULL,
  to_sha        text        NOT NULL,
  from_version  text,
  to_version    text,
  commit_count  integer     NOT NULL DEFAULT 0 CHECK (commit_count >= 0),
  notes         jsonb       NOT NULL,
  model         text        NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_sha, to_sha)
);

CREATE INDEX IF NOT EXISTS release_notes_cache_generated_at_idx
  ON public.release_notes_cache (generated_at DESC);

ALTER TABLE public.release_notes_cache ENABLE ROW LEVEL SECURITY;

-- Signed-in users can read cached notes (global, non-user content).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'release_notes_cache'
      AND policyname = 'Signed-in users can read release notes cache'
  ) THEN
    CREATE POLICY "Signed-in users can read release notes cache"
      ON public.release_notes_cache
      FOR SELECT
      USING (current_profile_id() IS NOT NULL);
  END IF;
END $$;

-- No INSERT/UPDATE/DELETE policies for authenticated/anon:
-- only the service role (bypasses RLS) writes from the server.
