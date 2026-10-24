-- Persist generated / user-edited ProfileTree content for the signed-in settings profile.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_tree JSONB,
  ADD COLUMN IF NOT EXISTS profile_tree_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_tree_source TEXT
    CHECK (profile_tree_source IN ('tailored-seed', 'llm-generated', 'partial-generated', 'user-edited'));

-- Keep timestamps in sync whenever the persisted tree changes.
CREATE OR REPLACE FUNCTION update_profiles_profile_tree_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.profile_tree IS DISTINCT FROM OLD.profile_tree THEN
    NEW.profile_tree_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_profile_tree_updated_at ON profiles;
CREATE TRIGGER profiles_profile_tree_updated_at
  BEFORE UPDATE OF profile_tree ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_profile_tree_updated_at();

-- Profiles are one row per Clerk user; RLS should keep profile content private.
-- Policies must use clerk_sub(), not current_profile_id(). That function selects from
-- profiles, so a policy that calls it recurses and every profile read fails.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY profiles_select_self
      ON profiles FOR SELECT TO authenticated
      USING (clerk_user_id = public.clerk_sub());
  END IF;
END $$;

-- Lightweight revision history for generated/edited profile trees.
CREATE TABLE IF NOT EXISTS profile_tree_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  profile_tree JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('tailored-seed', 'llm-generated', 'partial-generated', 'user-edited')),
  status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'superseded', 'failed')),
  review_score NUMERIC,
  generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profile_tree_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_tree_revisions'
      AND policyname = 'Users can view their own profile revisions'
  ) THEN
    CREATE POLICY "Users can view their own profile revisions"
      ON profile_tree_revisions FOR SELECT TO authenticated
      USING (
        owner_id = (
          SELECT profiles.id FROM profiles WHERE profiles.clerk_user_id = public.clerk_sub()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_tree_revisions'
      AND policyname = 'Users can insert their own profile revisions'
  ) THEN
    CREATE POLICY "Users can insert their own profile revisions"
      ON profile_tree_revisions FOR INSERT TO authenticated
      WITH CHECK (
        owner_id = (
          SELECT profiles.id FROM profiles WHERE profiles.clerk_user_id = public.clerk_sub()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_tree_revisions'
      AND policyname = 'Users can update their own profile revisions'
  ) THEN
    CREATE POLICY "Users can update their own profile revisions"
      ON profile_tree_revisions FOR UPDATE TO authenticated
      USING (
        owner_id = (
          SELECT profiles.id FROM profiles WHERE profiles.clerk_user_id = public.clerk_sub()
        )
      )
      WITH CHECK (
        owner_id = (
          SELECT profiles.id FROM profiles WHERE profiles.clerk_user_id = public.clerk_sub()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY profiles_update_self
      ON profiles FOR UPDATE TO authenticated
      USING (clerk_user_id = public.clerk_sub())
      WITH CHECK (clerk_user_id = public.clerk_sub());
  END IF;
END $$;

-- A table created in the SQL editor does not automatically grant the API roles.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profile_tree_revisions TO authenticated;
GRANT ALL ON TABLE public.profile_tree_revisions TO service_role;

NOTIFY pgrst, 'reload schema';
