-- Persist generated / user-edited ProfileTree content for the signed-in settings profile.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_tree JSONB,
  ADD COLUMN IF NOT EXISTS profile_tree_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_tree_source TEXT
    CHECK (profile_tree_source IN ('tailored-seed', 'llm-generated', 'user-edited'));

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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
      ON profiles FOR SELECT
      USING (id = current_profile_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON profiles FOR UPDATE
      USING (id = current_profile_id())
      WITH CHECK (id = current_profile_id());
  END IF;
END $$;
