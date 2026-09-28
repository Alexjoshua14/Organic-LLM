-- Bootstrap migration. Run once in the intended Supabase project.
-- Requires public.profiles(id uuid) and public.current_profile_id() returning uuid (Clerk identity).
-- Existing tables cause the transaction to fail; review them before attempting an upgrade.
-- Keys and encryption stay in the application. No memory snapshots or drafts are stored here.
-- Then run memory_feedback_shared_memory.sql for optional user-approved memory sharing.
BEGIN;

CREATE TABLE public.memory_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Mem0/Qdrant ID, deliberately not a FK: feedback survives memory deletion.
  memory_id text NOT NULL CHECK (length(memory_id) BETWEEN 1 AND 256),
  signal text NOT NULL CHECK (signal IN ('up', 'down')),
  source text NOT NULL CHECK (source IN ('memory_lens', 'memory_ingest')),
  note_ciphertext text,
  note_approved_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, memory_id),
  CHECK ((note_ciphertext IS NULL) = (note_approved_at IS NULL)),
  CHECK (note_ciphertext IS NULL OR (
    length(note_ciphertext) <= 16000 AND
    note_ciphertext ~ '^enc:v1:[^:]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$'
  ))
);

CREATE INDEX memory_feedback_owner_created ON public.memory_feedback(user_id, created_at DESC, id);
CREATE INDEX memory_feedback_updated ON public.memory_feedback(updated_at DESC);

CREATE FUNCTION public.update_memory_feedback() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.memory_id IS DISTINCT FROM OLD.memory_id THEN
      RAISE EXCEPTION 'Feedback ownership and memory ID cannot change';
    END IF;
    IF NEW.signal IS DISTINCT FROM OLD.signal THEN
      NEW.note_ciphertext := NULL;
    END IF;
    NEW.revision := OLD.revision + 1;
    NEW.updated_at := clock_timestamp();
    IF NEW.note_ciphertext IS NOT DISTINCT FROM OLD.note_ciphertext THEN
      NEW.note_approved_at := OLD.note_approved_at;
      RETURN NEW;
    END IF;
  END IF;
  NEW.note_approved_at := CASE WHEN NEW.note_ciphertext IS NULL THEN NULL ELSE clock_timestamp() END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_memory_feedback() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER memory_feedback_update BEFORE INSERT OR UPDATE ON public.memory_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_memory_feedback();

ALTER TABLE public.memory_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_feedback_owner ON public.memory_feedback FOR ALL TO authenticated
USING (user_id = (SELECT public.current_profile_id()))
WITH CHECK (user_id = (SELECT public.current_profile_id()));
REVOKE ALL ON public.memory_feedback FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.memory_feedback TO authenticated;
GRANT INSERT (user_id, memory_id, signal, source) ON public.memory_feedback TO authenticated;
-- Upsert must be allowed to update its conflict keys, but they cannot change ownership via RLS.
GRANT UPDATE (user_id, memory_id, signal, source, note_ciphertext) ON public.memory_feedback TO authenticated;
GRANT SELECT ON public.memory_feedback TO service_role;

CREATE TABLE public.memory_quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('ingest', 'delete', 'feedback', 'eval_run')),
  source text NOT NULL CHECK (source IN ('delphi', 'auto_ingest', 'migration', 'eval', 'unknown')),
  memory_id text,
  char_count integer CHECK (char_count >= 0),
  word_count integer CHECK (word_count >= 0),
  -- Only numeric/boolean telemetry. No arbitrary text or nested values.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object' AND
    metadata - ARRAY['infer', 'dryRun', 'total', 'passed', 'failed', 'avgCharCount', 'wiped'] = '{}'::jsonb AND
    NOT jsonb_path_exists(metadata, '$.* ? (@.type() != "number" && @.type() != "boolean")')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX memory_quality_events_owner_created ON public.memory_quality_events(user_id, created_at DESC);
ALTER TABLE public.memory_quality_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_quality_events_owner ON public.memory_quality_events FOR ALL TO authenticated
USING (user_id = (SELECT public.current_profile_id()))
WITH CHECK (user_id = (SELECT public.current_profile_id()));
REVOKE ALL ON public.memory_quality_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.memory_quality_events TO authenticated;

CREATE TABLE public.memory_quality_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  source text NOT NULL CHECK (source IN ('all', 'delphi', 'auto_ingest', 'migration', 'eval', 'unknown')),
  ingest_count integer NOT NULL DEFAULT 0 CHECK (ingest_count >= 0),
  delete_count integer NOT NULL DEFAULT 0 CHECK (delete_count >= 0),
  feedback_up integer NOT NULL DEFAULT 0 CHECK (feedback_up >= 0),
  feedback_down integer NOT NULL DEFAULT 0 CHECK (feedback_down >= 0),
  char_count_mean double precision,
  char_count_p50 double precision,
  char_count_p90 double precision,
  delete_rate double precision,
  positive_rate double precision,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, day, source)
);
ALTER TABLE public.memory_quality_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_quality_daily_owner ON public.memory_quality_daily FOR ALL TO authenticated
USING (user_id = (SELECT public.current_profile_id()))
WITH CHECK (user_id = (SELECT public.current_profile_id()));
REVOKE ALL ON public.memory_quality_daily FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.memory_quality_daily TO authenticated;

COMMIT;
