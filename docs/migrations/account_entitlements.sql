-- Plan entitlements and usage resets.
-- Apply once as postgres in the Supabase SQL editor or migration pipeline; not auto-applied.
-- Until it runs, Organic treats every user as `free` on a fixed weekly window (Mondays 00:00
-- UTC) with resets unavailable, provided the existing usage ledger is readable. Unreadable
-- spend always pauses new requests; a missing ledger is never treated as zero spend.
--
-- A user's plan and reset credits are authorization data, so — like admin_access — they live
-- outside the user-editable profile. Users may read their own row; only postgres/service_role
-- write it. Grant plans by verified Clerk user id (scripts/set-plan.ts), never by the
-- user-editable profiles.email.
BEGIN;

-- The spend ledger is authorization data too. Clients can read their usage, never mutate it.
-- Explicitly remove ALL privileges first (including TRUNCATE, which is not governed by RLS).
REVOKE ALL ON TABLE public.llm_usage_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.llm_usage_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.llm_usage_events TO service_role;
DROP POLICY IF EXISTS "Users can insert their own usage events" ON public.llm_usage_events;

-- Retain accounting history when a profile is removed. IDs here are internal profile IDs,
-- not email addresses or attachment/message content. A deleted profile cannot read the ledger.
ALTER TABLE public.llm_usage_events DROP CONSTRAINT IF EXISTS llm_usage_events_owner_id_fkey;

CREATE OR REPLACE FUNCTION public.reject_usage_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Usage ledger is append-only; append an adjustment instead.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_usage_ledger_mutation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS llm_usage_events_immutable ON public.llm_usage_events;
CREATE TRIGGER llm_usage_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.llm_usage_events FOR EACH STATEMENT EXECUTE FUNCTION public.reject_usage_ledger_mutation();

CREATE TABLE IF NOT EXISTS public.llm_usage_adjustments (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL,
  event_id UUID REFERENCES public.llm_usage_events(id) ON DELETE RESTRICT,
  delta_usd NUMERIC(12, 6) NOT NULL CHECK (delta_usd <> 0),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A charge correction belongs to the original charge's window; a general credit/debit
  -- belongs to the current window. The RPC derives this, never the client.
  effective_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_adjustments_owner_effective
  ON public.llm_usage_adjustments(owner_id, effective_at);
ALTER TABLE public.llm_usage_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.llm_usage_adjustments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.llm_usage_adjustments TO authenticated;
GRANT SELECT, INSERT ON TABLE public.llm_usage_adjustments TO service_role;
DROP POLICY IF EXISTS llm_usage_adjustments_select_self ON public.llm_usage_adjustments;
CREATE POLICY llm_usage_adjustments_select_self ON public.llm_usage_adjustments
  FOR SELECT TO authenticated USING (owner_id = (SELECT public.current_profile_id()));
DROP POLICY IF EXISTS llm_usage_adjustments_service_role ON public.llm_usage_adjustments;
CREATE POLICY llm_usage_adjustments_service_role ON public.llm_usage_adjustments
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS llm_usage_adjustments_immutable ON public.llm_usage_adjustments;
CREATE TRIGGER llm_usage_adjustments_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON public.llm_usage_adjustments FOR EACH STATEMENT EXECUTE FUNCTION public.reject_usage_ledger_mutation();

-- Only the trusted server calls this after requireAdmin(). UUID is an idempotency key:
-- a retry returns the original row only if every submitted field still matches.
CREATE OR REPLACE FUNCTION public.append_llm_usage_adjustment(
  p_id UUID, p_owner UUID, p_event_id UUID, p_delta NUMERIC, p_reason TEXT, p_actor UUID
)
RETURNS SETOF public.llm_usage_adjustments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_effective TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner) OR
     NOT EXISTS (SELECT 1 FROM public.admin_access WHERE profile_id = p_actor) THEN
    RAISE EXCEPTION 'Invalid adjustment scope' USING ERRCODE = '42501';
  END IF;
  IF p_event_id IS NULL THEN
    v_effective := clock_timestamp();
  ELSE
    SELECT created_at INTO v_effective FROM public.llm_usage_events
      WHERE id = p_event_id AND owner_id = p_owner;
    IF v_effective IS NULL THEN
      RAISE EXCEPTION 'Invalid adjustment scope' USING ERRCODE = '42501';
    END IF;
  END IF;
  INSERT INTO public.llm_usage_adjustments (id, owner_id, event_id, delta_usd, reason, created_by, effective_at)
    VALUES (p_id, p_owner, p_event_id, p_delta, p_reason, p_actor, v_effective)
    ON CONFLICT (id) DO NOTHING;
  RETURN QUERY SELECT a.* FROM public.llm_usage_adjustments a WHERE a.id = p_id
    AND a.owner_id = p_owner AND a.event_id IS NOT DISTINCT FROM p_event_id
    AND a.delta_usd = p_delta AND a.reason = p_reason AND a.created_by = p_actor;
END;
$$;
REVOKE ALL ON FUNCTION public.append_llm_usage_adjustment(UUID, UUID, UUID, NUMERIC, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_llm_usage_adjustment(UUID, UUID, UUID, NUMERIC, TEXT, UUID)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.account_entitlements (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus', 'pro', 'max')),
  resets_remaining INTEGER NOT NULL DEFAULT 5 CHECK (resets_remaining >= 0),
  -- Start of the user's weekly budget windows. Windows repeat every 7 days from here; spending a
  -- reset moves it to now().
  cycle_anchor TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_entitlements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.account_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_entitlements TO service_role;

DROP POLICY IF EXISTS account_entitlements_select_self ON public.account_entitlements;
CREATE POLICY account_entitlements_select_self ON public.account_entitlements
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT public.current_profile_id()));

DROP POLICY IF EXISTS account_entitlements_service_role ON public.account_entitlements;
CREATE POLICY account_entitlements_service_role ON public.account_entitlements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.account_entitlements IS
  'Plan and usage-reset credits per profile. Users read only their own row; only postgres/service_role write.';

-- Every new profile starts on free with 5 resets, whatever path created it.
CREATE OR REPLACE FUNCTION public.account_entitlements_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  INSERT INTO public.account_entitlements (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.account_entitlements_on_profile_insert() FROM PUBLIC;
DROP TRIGGER IF EXISTS account_entitlements_on_profile_insert ON public.profiles;
CREATE TRIGGER account_entitlements_on_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.account_entitlements_on_profile_insert();

-- Existing users get the same defaults as new ones.
INSERT INTO public.account_entitlements (profile_id)
SELECT id FROM public.profiles
ON CONFLICT (profile_id) DO NOTHING;

-- Compare-and-set against the exact anchor the client confirmed. Concurrent clicks/retries
-- for that window consume at most one credit. No row means stale window or no credits.
-- Remove the old one-argument function if the initial migration was already applied.
DROP FUNCTION IF EXISTS public.consume_usage_reset(UUID);
CREATE OR REPLACE FUNCTION public.consume_usage_reset(p_profile_id UUID, p_expected_anchor TIMESTAMPTZ)
RETURNS TABLE (resets_remaining INTEGER, cycle_anchor TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  UPDATE public.account_entitlements AS e
  SET resets_remaining = e.resets_remaining - 1,
      cycle_anchor = clock_timestamp(),
      updated_at = now()
  WHERE e.profile_id = p_profile_id
    AND e.resets_remaining > 0
    AND e.cycle_anchor = p_expected_anchor
  RETURNING e.resets_remaining, e.cycle_anchor;
$$;

REVOKE ALL ON FUNCTION public.consume_usage_reset(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_usage_reset(UUID, TIMESTAMPTZ) TO service_role;

-- Spend in a window, summed in the database (uses idx_llm_usage_events_owner_created).
-- The owner parameter takes the column's own type, so the index stays usable.
CREATE OR REPLACE FUNCTION public.sum_llm_usage_cost(
  p_owner public.llm_usage_events.owner_id%TYPE,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT GREATEST(0,
    COALESCE((SELECT SUM(cost_usd) FROM public.llm_usage_events
      WHERE owner_id = p_owner AND created_at >= p_since AND created_at < p_until), 0)
    + COALESCE((SELECT SUM(delta_usd) FROM public.llm_usage_adjustments
      WHERE owner_id = p_owner AND effective_at >= p_since AND effective_at < p_until), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.sum_llm_usage_cost(public.llm_usage_events.owner_id%TYPE, TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sum_llm_usage_cost(public.llm_usage_events.owner_id%TYPE, TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Change one user's plan or resets with scripts/set-plan.ts, which resolves a *verified* Clerk
-- email to exactly one profile. The equivalent SQL, as postgres, by verified Clerk user id:
--
-- UPDATE public.account_entitlements e
-- SET plan = 'pro', resets_remaining = 25, updated_at = now()
-- FROM public.profiles p
-- WHERE p.id = e.profile_id AND p.clerk_user_id = 'REPLACE_WITH_VERIFIED_CLERK_USER_ID';
