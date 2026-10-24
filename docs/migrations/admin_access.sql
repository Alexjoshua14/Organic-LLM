-- Admin membership is separate from user-editable profiles.
-- Apply once as postgres in the Supabase SQL editor or migration pipeline.
-- No account is granted access by this migration.
BEGIN;

CREATE TABLE public.admin_access (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_access ENABLE ROW LEVEL SECURITY;

-- Clear Supabase/default grants, then grant only the required operations.
REVOKE ALL ON TABLE public.admin_access FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.admin_access TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.admin_access TO service_role;

CREATE POLICY admin_access_select_self ON public.admin_access
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT public.current_profile_id()));

CREATE POLICY admin_access_service_role ON public.admin_access
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.admin_access IS
  'A row grants app admin access. Only postgres/service_role may grant or revoke membership; users can read only their own membership.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Bootstrap separately as postgres after confirming the account in Clerk.
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
--   INSERT INTO public.admin_access (profile_id)
--   VALUES (target_profile)
--   ON CONFLICT (profile_id) DO NOTHING;
-- END;
-- $$;
--
-- Revoke access as postgres/service_role:
-- DELETE FROM public.admin_access WHERE profile_id = 'REPLACE_WITH_PROFILE_UUID';
