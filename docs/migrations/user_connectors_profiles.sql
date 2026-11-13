-- Migration: durable user connectors profile (private dossier + connector handles)
-- One row per Organic profile. The whole profile is a single JSON document, encrypted by the
-- app (AES-256-GCM, per-user key, see lib/crypto/message-encryption.ts) before it is written:
-- GitHub handle and cached public snapshot, LinkedIn/website/X handles, education, career
-- history, resume, working preferences, and the subagent-sharing consent flag.
-- The document shape is deliberately open: the app preserves fields it does not know, so a
-- newer deploy's fields survive an older instance's write. No column here depends on them.
--
-- Keyed by the Organic profile id (never an auth-provider id) so the auth provider stays
-- swappable and deleting a profile deletes its data.
--
-- Server-only: RLS is enabled with NO policies (deny-all for anon/authenticated) and every
-- privilege is revoked except for service_role. The browser never reads this table.
-- Apply in the Supabase SQL editor BEFORE deploying the code that uses it. Not auto-applied.
-- Until applied, saving the profile returns 503 and chat turns run without a dossier.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_connectors_profiles (
  -- Always supplied by server code from the authenticated session, never a client value.
  owner_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Ciphertext only. The cap is far above the profile's own field limits (about 100 KB of
  -- text plus a snapshot) after base64 expansion, and stops a runaway write.
  payload_ciphertext text NOT NULL CHECK (char_length(payload_ciphertext) BETWEEN 1 AND 400000),
  -- Bumped by the trigger below on every payload change; saves compare-and-swap on it.
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_connectors_profiles ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: anon and authenticated can do nothing with this table.
REVOKE ALL ON public.user_connectors_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_connectors_profiles TO service_role;

CREATE OR REPLACE FUNCTION public.user_connectors_profiles_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.payload_ciphertext IS DISTINCT FROM OLD.payload_ciphertext THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.user_connectors_profiles_before_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_connectors_profiles_before_update ON public.user_connectors_profiles;
CREATE TRIGGER user_connectors_profiles_before_update
  BEFORE UPDATE ON public.user_connectors_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_connectors_profiles_before_update();

COMMIT;

-- Rollback (deletes every stored connectors profile; browser copies remain):
--   DROP TABLE IF EXISTS public.user_connectors_profiles;
--   DROP FUNCTION IF EXISTS public.user_connectors_profiles_before_update();
