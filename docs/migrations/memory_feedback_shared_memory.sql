-- Run once AFTER memory_quality_tables.sql in the intended Supabase project.
-- Adds an optional, explicitly shared memory copy. Existing feedback stays unshared.
-- Encryption and keys stay in the application; drafts and chat context are never stored.
BEGIN;

ALTER TABLE public.memory_feedback
  ADD COLUMN memory_ciphertext text,
  ADD COLUMN memory_shared_at timestamptz,
  ADD CONSTRAINT memory_feedback_shared_memory_approval CHECK (
    (memory_ciphertext IS NULL) = (memory_shared_at IS NULL)
  ),
  ADD CONSTRAINT memory_feedback_shared_memory_encrypted CHECK (
    memory_ciphertext IS NULL OR (
      length(memory_ciphertext) <= 90000 AND
      memory_ciphertext ~ '^enc:v1:[^:]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$'
    )
  );

CREATE OR REPLACE FUNCTION public.update_memory_feedback() RETURNS trigger
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
    NEW.note_approved_at := CASE
      WHEN NEW.note_ciphertext IS NULL THEN NULL
      WHEN NEW.note_ciphertext IS NOT DISTINCT FROM OLD.note_ciphertext THEN OLD.note_approved_at
      ELSE clock_timestamp()
    END;
    -- Sharing a memory is separate from approving a note. Keep its consent timestamp
    -- when editing the note or changing the vote; removing the copy revokes sharing.
    NEW.memory_shared_at := CASE
      WHEN NEW.memory_ciphertext IS NULL THEN NULL
      WHEN NEW.memory_ciphertext IS NOT DISTINCT FROM OLD.memory_ciphertext THEN OLD.memory_shared_at
      ELSE clock_timestamp()
    END;
  ELSE
    NEW.note_approved_at := CASE WHEN NEW.note_ciphertext IS NULL THEN NULL ELSE clock_timestamp() END;
    NEW.memory_shared_at := CASE WHEN NEW.memory_ciphertext IS NULL THEN NULL ELSE clock_timestamp() END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.update_memory_feedback() FROM PUBLIC, anon, authenticated;
GRANT UPDATE (memory_ciphertext) ON public.memory_feedback TO authenticated;

COMMIT;
