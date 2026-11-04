BEGIN;

-- Follow-up to chat_stream_admission.sql (apply that first). Apply before deploying callers.
-- Policy (provisional): at most 5 active threads per owner; at most 5 subagents per active
-- orchestrator thread, so at most 25 subagents per owner.
--
-- A thread is *active* if it holds a chat lease or is the parent of a live subagent lease. An
-- orchestrator waiting on its workers therefore keeps its slot without holding a lease row, and
-- is not busy: the user and heartbeat turns can still send to it without taking a second slot.

ALTER TABLE public.chat_stream_leases
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS parent_thread_id uuid REFERENCES public.threads(id) ON DELETE CASCADE;
ALTER TABLE public.chat_stream_leases DROP CONSTRAINT IF EXISTS chat_stream_leases_kind_check;
ALTER TABLE public.chat_stream_leases ADD CONSTRAINT chat_stream_leases_kind_check CHECK (
  (kind = 'chat' AND parent_thread_id IS NULL)
  OR (kind = 'subagent' AND parent_thread_id IS NOT NULL AND parent_thread_id <> thread_id)
);
CREATE INDEX IF NOT EXISTS chat_stream_leases_parent
  ON public.chat_stream_leases(parent_thread_id) WHERE parent_thread_id IS NOT NULL;

-- Lock strength: FOR NO KEY UPDATE on the profile still conflicts with itself, so admissions
-- for one owner serialize, but unlike FOR UPDATE it does not block the FOR KEY SHARE locks that
-- foreign-key inserts referencing the profile take. FOR KEY SHARE on threads stops a thread
-- being deleted mid-admission without blocking its updates or child inserts.

CREATE OR REPLACE FUNCTION public.acquire_chat_stream_lease(
  p_owner_id uuid, p_thread_id uuid, p_token uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = p_owner_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM public.threads WHERE id = p_thread_id AND owner_id = p_owner_id FOR KEY SHARE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  DELETE FROM public.chat_stream_leases WHERE owner_id = p_owner_id AND expires_at <= clock_timestamp();
  IF EXISTS (SELECT 1 FROM public.chat_stream_leases WHERE thread_id = p_thread_id) THEN
    RETURN 'busy';
  END IF;
  -- An orchestrator already active through its workers takes no new slot.
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_stream_leases
    WHERE owner_id = p_owner_id AND kind = 'subagent' AND parent_thread_id = p_thread_id
  ) AND (
    SELECT count(*) FROM (
      SELECT thread_id FROM public.chat_stream_leases WHERE owner_id = p_owner_id AND kind = 'chat'
      UNION
      SELECT parent_thread_id FROM public.chat_stream_leases
        WHERE owner_id = p_owner_id AND kind = 'subagent'
    ) active_threads
  ) >= 5 THEN
    RETURN 'capacity';
  END IF;
  -- Live chat, queue, and heartbeat routes have a 300-second execution ceiling.
  -- Ten minutes also allows a grace period for platform termination and cleanup.
  INSERT INTO public.chat_stream_leases(thread_id, owner_id, token, expires_at, kind)
    VALUES (p_thread_id, p_owner_id, p_token, clock_timestamp() + interval '10 minutes', 'chat');
  RETURN 'acquired';
END;
$$;

CREATE OR REPLACE FUNCTION public.acquire_subagent_stream_lease(
  p_owner_id uuid, p_parent_thread_id uuid, p_thread_id uuid, p_token uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_parent_thread_id = p_thread_id THEN RETURN 'not_found'; END IF;
  -- Same per-owner lock as chat admission: chat and subagent admissions serialize together.
  PERFORM 1 FROM public.profiles WHERE id = p_owner_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM public.threads WHERE id = p_parent_thread_id AND owner_id = p_owner_id FOR KEY SHARE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM public.threads WHERE id = p_thread_id AND owner_id = p_owner_id FOR KEY SHARE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  DELETE FROM public.chat_stream_leases WHERE owner_id = p_owner_id AND expires_at <= clock_timestamp();
  IF EXISTS (SELECT 1 FROM public.chat_stream_leases WHERE thread_id = p_thread_id) THEN
    RETURN 'busy';
  END IF;
  IF (
    SELECT count(*) FROM public.chat_stream_leases
    WHERE owner_id = p_owner_id AND kind = 'subagent' AND parent_thread_id = p_parent_thread_id
  ) >= 5 THEN
    RETURN 'capacity';
  END IF;
  -- A worker admitted after its orchestrator's own stream ended re-activates the orchestrator,
  -- which must fit in the owner's active-thread cap.
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_stream_leases
    WHERE owner_id = p_owner_id
      AND ((kind = 'chat' AND thread_id = p_parent_thread_id)
        OR (kind = 'subagent' AND parent_thread_id = p_parent_thread_id))
  ) AND (
    SELECT count(*) FROM (
      SELECT thread_id FROM public.chat_stream_leases WHERE owner_id = p_owner_id AND kind = 'chat'
      UNION
      SELECT parent_thread_id FROM public.chat_stream_leases
        WHERE owner_id = p_owner_id AND kind = 'subagent'
    ) active_threads
  ) >= 5 THEN
    RETURN 'capacity';
  END IF;
  INSERT INTO public.chat_stream_leases(thread_id, owner_id, token, expires_at, kind, parent_thread_id)
    VALUES (
      p_thread_id, p_owner_id, p_token, clock_timestamp() + interval '10 minutes',
      'subagent', p_parent_thread_id
    );
  RETURN 'acquired';
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_chat_stream_lease(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_chat_stream_lease(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.acquire_subagent_stream_lease(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_subagent_stream_lease(uuid, uuid, uuid, uuid) TO service_role;

COMMIT;
