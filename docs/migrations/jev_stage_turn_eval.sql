-- Lean turn-eval table for the Jev Stage prototype (memory_feedback shape, storage-optimized).
-- Notes are optional ciphertext; no full message bodies. Run once in the intended Supabase project.
BEGIN;

CREATE TABLE public.jev_stage_turn_eval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Prototype turn id (request UUID). Not a FK: evals survive local Redis reset.
  turn_id text NOT NULL CHECK (length(turn_id) BETWEEN 1 AND 64),
  signal text NOT NULL CHECK (signal IN ('up', 'down')),
  -- Optional short note; encrypted in the app. Cap keeps rows small.
  note_ciphertext text,
  note_approved_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, turn_id),
  CHECK ((note_ciphertext IS NULL) = (note_approved_at IS NULL)),
  CHECK (note_ciphertext IS NULL OR (
    length(note_ciphertext) <= 4000 AND
    note_ciphertext ~ '^enc:v1:[^:]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$'
  ))
);

CREATE INDEX jev_stage_turn_eval_owner_updated
  ON public.jev_stage_turn_eval(user_id, updated_at DESC, id);

CREATE FUNCTION public.update_jev_stage_turn_eval() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.turn_id IS DISTINCT FROM OLD.turn_id THEN
      RAISE EXCEPTION 'Eval ownership and turn ID cannot change';
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

REVOKE ALL ON FUNCTION public.update_jev_stage_turn_eval() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER jev_stage_turn_eval_update
  BEFORE INSERT OR UPDATE ON public.jev_stage_turn_eval
  FOR EACH ROW EXECUTE FUNCTION public.update_jev_stage_turn_eval();

ALTER TABLE public.jev_stage_turn_eval ENABLE ROW LEVEL SECURITY;
CREATE POLICY jev_stage_turn_eval_owner ON public.jev_stage_turn_eval FOR ALL TO authenticated
USING (user_id = (SELECT public.current_profile_id()))
WITH CHECK (user_id = (SELECT public.current_profile_id()));
REVOKE ALL ON public.jev_stage_turn_eval FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.jev_stage_turn_eval TO authenticated;
GRANT INSERT (user_id, turn_id, signal, note_ciphertext) ON public.jev_stage_turn_eval TO authenticated;
GRANT UPDATE (user_id, turn_id, signal, note_ciphertext) ON public.jev_stage_turn_eval TO authenticated;
GRANT SELECT ON public.jev_stage_turn_eval TO service_role;

COMMIT;
