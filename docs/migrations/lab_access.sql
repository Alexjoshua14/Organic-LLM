-- Lab membership: unfinished surfaces (sandbox, labs, prototypes, Stage) without admin rights.
-- Same controls as public.admin_access, kept in its own table because an admin_access row means
-- "admin" everywhere it is read, including in SQL. Admins see labs without a row here.
-- Apply once as postgres in the Supabase SQL editor or migration pipeline.
-- No account is granted access by this migration.
BEGIN;

CREATE TABLE public.lab_access (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_access ENABLE ROW LEVEL SECURITY;

-- Clear Supabase/default grants, then grant only the required operations.
REVOKE ALL ON TABLE public.lab_access FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.lab_access TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.lab_access TO service_role;

CREATE POLICY lab_access_select_self ON public.lab_access
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT public.current_profile_id()));

CREATE POLICY lab_access_service_role ON public.lab_access
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.lab_access IS
  'A row grants access to unfinished surfaces (labs), not admin. Only postgres/service_role may grant or revoke membership; users can read only their own membership.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Grant separately as postgres after confirming the account in Clerk.
-- Use its verified Clerk user id, not the user-editable profiles.email field.
-- INTO STRICT fails if the profile is missing or ambiguous.
--
-- DO $$
-- DECLARE
--   target_profile UUID;
-- BEGIN
--   SELECT id INTO STRICT target_profile
--   FROM public.profiles
--   WHERE clerk_user_id = 'REPLACE_WITH_VERIFIED_CLERK_USER_ID';
--
--   INSERT INTO public.lab_access (profile_id)
--   VALUES (target_profile)
--   ON CONFLICT (profile_id) DO NOTHING;
-- END;
-- $$;
--
-- Revoke access as postgres/service_role:
-- DELETE FROM public.lab_access WHERE profile_id = 'REPLACE_WITH_PROFILE_UUID';
