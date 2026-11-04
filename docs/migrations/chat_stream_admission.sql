BEGIN;

-- Apply before deploying callers. Drain pre-migration turns during rollout.
CREATE TABLE IF NOT EXISTS public.chat_stream_leases (
  thread_id uuid PRIMARY KEY REFERENCES public.threads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_stream_leases_owner ON public.chat_stream_leases(owner_id);
ALTER TABLE public.chat_stream_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_stream_leases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chat_stream_leases TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_chat_stream_lease(
  p_owner_id uuid, p_thread_id uuid, p_token uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- All admissions for one account serialize, across live and queued sends.
  PERFORM 1 FROM public.profiles WHERE id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM public.threads WHERE id = p_thread_id AND owner_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  DELETE FROM public.chat_stream_leases WHERE owner_id = p_owner_id AND expires_at <= clock_timestamp();
  IF EXISTS (SELECT 1 FROM public.chat_stream_leases WHERE thread_id = p_thread_id) THEN
    RETURN 'busy';
  END IF;
  IF (SELECT count(*) FROM public.chat_stream_leases WHERE owner_id = p_owner_id) >= 5 THEN
    RETURN 'capacity';
  END IF;
  -- Live chat, queue, and heartbeat routes have a 300-second execution ceiling.
  -- Ten minutes also allows a grace period for platform termination and cleanup.
  INSERT INTO public.chat_stream_leases(thread_id, owner_id, token, expires_at)
    VALUES (p_thread_id, p_owner_id, p_token, clock_timestamp() + interval '10 minutes');
  RETURN 'acquired';
END;
$$;
REVOKE ALL ON FUNCTION public.acquire_chat_stream_lease(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_chat_stream_lease(uuid, uuid, uuid) TO service_role;

COMMIT;
