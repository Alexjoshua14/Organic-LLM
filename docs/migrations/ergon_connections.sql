-- Migration: durable, per-user Ergon connections (OAuth session held for the user)
-- One row per Organic profile: that user's own Ergon access/refresh tokens, stored as
-- ciphertext (AES-256-GCM, per-user key, see lib/crypto/message-encryption.ts) plus
-- connection metadata. Ergon is a separate application; this row holds only what the user
-- delegated through the in-app OAuth connect flow. No Ergon service credentials live here.
--
-- Server-only: RLS is enabled with NO policies (deny-all for anon/authenticated) and every
-- privilege is revoked except for service_role. The browser never reads this table.
-- Apply in the Supabase SQL editor BEFORE deploying the code that uses it. Not auto-applied.
-- Until applied, Connect with Ergon fails with an error instead of reporting "connected".

BEGIN;

CREATE TABLE IF NOT EXISTS public.ergon_connections (
  -- Always supplied by server code from the authenticated session, never a client value.
  owner_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (char_length(url) BETWEEN 1 AND 500),
  mcp_url text NOT NULL CHECK (char_length(mcp_url) BETWEEN 1 AND 500),
  scopes text[] NOT NULL
    CHECK (cardinality(scopes) BETWEEN 1 AND 3 AND scopes <@ ARRAY['read', 'write', 'agents']::text[]),
  token_ciphertext text NOT NULL CHECK (char_length(token_ciphertext) BETWEEN 1 AND 20000),
  refresh_token_ciphertext text CHECK (char_length(refresh_token_ciphertext) BETWEEN 1 AND 20000),
  expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_ok_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Bumped by the trigger below whenever a token changes; refreshes compare-and-swap on it.
  version bigint NOT NULL DEFAULT 1,
  -- Cross-instance refresh lock (see claim_ergon_refresh_lock). NULL or past = unlocked.
  refresh_lock_until timestamptz
);

ALTER TABLE public.ergon_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: anon and authenticated can do nothing with this table.
REVOKE ALL ON public.ergon_connections FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ergon_connections TO service_role;

CREATE OR REPLACE FUNCTION public.ergon_connections_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.token_ciphertext IS DISTINCT FROM OLD.token_ciphertext
     OR NEW.refresh_token_ciphertext IS DISTINCT FROM OLD.refresh_token_ciphertext THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := OLD.version;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ergon_connections_before_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ergon_connections_before_update ON public.ergon_connections;
CREATE TRIGGER ergon_connections_before_update
  BEFORE UPDATE ON public.ergon_connections
  FOR EACH ROW EXECUTE FUNCTION public.ergon_connections_before_update();

-- Claim the refresh lock using database time. Returns true when this caller may refresh.
-- SECURITY INVOKER on purpose: only service_role may execute it, and it needs no extra rights.
CREATE OR REPLACE FUNCTION public.claim_ergon_refresh_lock(p_owner_id uuid, p_ttl_seconds integer)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  UPDATE public.ergon_connections
     SET refresh_lock_until = clock_timestamp()
       + make_interval(secs => LEAST(GREATEST(p_ttl_seconds, 1), 120))
   WHERE owner_id = p_owner_id
     AND (refresh_lock_until IS NULL OR refresh_lock_until <= clock_timestamp());
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ergon_refresh_lock(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ergon_refresh_lock(uuid, integer) TO service_role;

COMMIT;

-- Rollback (deletes every stored Ergon connection; users reconnect):
--   DROP TABLE IF EXISTS public.ergon_connections;
--   DROP FUNCTION IF EXISTS public.claim_ergon_refresh_lock(uuid, integer);
--   DROP FUNCTION IF EXISTS public.ergon_connections_before_update();
