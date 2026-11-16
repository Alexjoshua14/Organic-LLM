-- Apply before enabling subscription connections. Service-role only; profile deletion cascades.
BEGIN;
CREATE TABLE IF NOT EXISTS public.subscription_connections (
  owner_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  payload_ciphertext text NOT NULL CHECK (
    payload_ciphertext LIKE 'enc:%' AND char_length(payload_ciphertext) <= 100000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.subscription_connection_leases (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('connection','turn')),
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(owner_id, kind)
);
ALTER TABLE public.subscription_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_connection_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_connections, public.subscription_connection_leases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.subscription_connections, public.subscription_connection_leases TO service_role;

CREATE OR REPLACE FUNCTION public.subscription_connection_operation(
  p_owner uuid, p_action text, p_kind text DEFAULT 'connection',
  p_lease uuid DEFAULT NULL, p_payload text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result text; affected integer;
BEGIN
  IF p_owner IS NULL OR p_kind NOT IN ('connection','turn') THEN
    RAISE EXCEPTION 'Invalid connection operation';
  END IF;
  IF p_action = 'read' THEN
    SELECT payload_ciphertext INTO result FROM public.subscription_connections WHERE owner_id = p_owner;
    RETURN to_jsonb(result);
  ELSIF p_action = 'acquire' AND p_lease IS NOT NULL THEN
    INSERT INTO public.subscription_connection_leases(owner_id, kind, token, expires_at)
      VALUES(p_owner, p_kind, p_lease, clock_timestamp() + interval '180 seconds')
      ON CONFLICT(owner_id,kind) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
      WHERE subscription_connection_leases.expires_at < clock_timestamp();
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN to_jsonb(affected = 1);
  ELSIF p_action = 'release' THEN
    DELETE FROM public.subscription_connection_leases
      WHERE owner_id = p_owner AND kind = p_kind AND token = p_lease;
    RETURN 'true'::jsonb;
  ELSIF p_action = 'write' AND p_kind = 'connection' THEN
    -- Hold the lease row lock through the write: an expired worker cannot overwrite its successor.
    PERFORM 1 FROM public.subscription_connection_leases
      WHERE owner_id = p_owner AND kind = 'connection' AND token = p_lease
        AND expires_at > clock_timestamp() FOR UPDATE;
    IF NOT FOUND THEN RETURN 'false'::jsonb; END IF;
    INSERT INTO public.subscription_connections(owner_id, payload_ciphertext)
      VALUES(p_owner,p_payload) ON CONFLICT(owner_id) DO UPDATE
      SET payload_ciphertext = EXCLUDED.payload_ciphertext, updated_at = clock_timestamp();
    RETURN 'true'::jsonb;
  END IF;
  RAISE EXCEPTION 'Invalid connection operation';
END;
$$;
REVOKE ALL ON FUNCTION public.subscription_connection_operation(uuid,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_connection_operation(uuid,text,text,uuid,text) TO service_role;
COMMIT;
