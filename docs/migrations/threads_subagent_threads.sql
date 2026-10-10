-- Arcadia recursive thread relationships + worker/heartbeat state (COA-251).
-- Hierarchy/status changes and deletion serialize per owner. Deletion is rejected
-- while the thread itself or any descendant is working, including stale working states.
-- Worker activation must persist 'working' successfully before work starts.
-- Database integration/concurrency testing is required before deployment.
--
-- A thread has at most one parent and may have many children. Child IDs are derived
-- by querying parent_thread_id, not stored in an array. Any thread can coordinate
-- children and carry worker state, including a detached former child.
-- Depth, worker-count, concurrency and budget limits belong in Organic LLM.
--
-- Run step 1 as a transaction, then step 2 separately (CONCURRENTLY requires this).
-- Existing invalid data is rejected, not silently detached or erased.

-- Step 1
BEGIN;

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS parent_thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS subagent_agent_id text;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS subagent_status text
  CHECK (subagent_status IS NULL OR subagent_status IN ('idle', 'working', 'done', 'blocked'));
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS subagent_status_at timestamptz;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS subagent_heartbeat_baseline text;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS subagent_heartbeat_digest text;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS subagent_heartbeat_at timestamptz;

-- Remove restrictions from the earlier non-recursive draft, if installed.
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_subagent_link_paired;
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_subagent_status_child_only;
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_subagent_heartbeat_orchestrator_only;
DROP TRIGGER IF EXISTS threads_detach_subagent_children ON public.threads;
DROP FUNCTION IF EXISTS public.threads_detach_subagent_children();

ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_subagent_not_self_parent;
ALTER TABLE public.threads ADD CONSTRAINT threads_subagent_not_self_parent
  CHECK (parent_thread_id IS NULL OR parent_thread_id <> id);

-- A linked worker needs a roster slot; detached threads may retain their identity.
ALTER TABLE public.threads DROP CONSTRAINT IF EXISTS threads_subagent_link_has_slot;
ALTER TABLE public.threads ADD CONSTRAINT threads_subagent_link_has_slot
  CHECK (parent_thread_id IS NULL OR subagent_agent_id IS NOT NULL);

-- Validate existing links without modifying conversation data. UNION (not UNION ALL)
-- terminates even if an existing hierarchy already contains a cycle.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.threads c JOIN public.threads p ON p.id = c.parent_thread_id
    WHERE c.owner_id IS DISTINCT FROM p.owner_id
  ) THEN
    RAISE EXCEPTION 'Existing thread hierarchy contains cross-owner links';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestry AS (
      SELECT id AS origin, parent_thread_id AS ancestor FROM public.threads
      WHERE parent_thread_id IS NOT NULL
      UNION
      SELECT a.origin, p.parent_thread_id
      FROM ancestry a JOIN public.threads p ON p.id = a.ancestor
      WHERE p.parent_thread_id IS NOT NULL
    )
    SELECT 1 FROM ancestry WHERE origin = ancestor
  ) THEN
    RAISE EXCEPTION 'Existing thread hierarchy contains a cycle';
  END IF;
END;
$$;

-- A transaction-held serialization row per owner coordinates activation, reparenting,
-- ownership changes and deletion, including changes made outside the application.
-- An actual write (rather than an advisory lock alone) also causes stale snapshots at
-- REPEATABLE READ / SERIALIZABLE to fail with a serialization error instead of allowing
-- an outdated subtree check. At READ COMMITTED, subsequent volatile trigger queries
-- see the latest committed state after waiting for this write.
-- Keep these rows: deleting a lock row could create two independent locks for one owner.
CREATE TABLE IF NOT EXISTS public.threads_hierarchy_locks (
  owner_key text PRIMARY KEY,
  revision boolean NOT NULL DEFAULT false
);
ALTER TABLE public.threads_hierarchy_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.threads_hierarchy_locks FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.threads_lock_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  owner_keys text[];
  lock_owner text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    owner_keys := ARRAY[COALESCE(NEW.owner_id::text, '')];
  ELSIF TG_OP = 'DELETE' THEN
    owner_keys := ARRAY[COALESCE(OLD.owner_id::text, '')];
  ELSE
    owner_keys := ARRAY[COALESCE(OLD.owner_id::text, ''), COALESCE(NEW.owner_id::text, '')];
  END IF;

  -- Ownership transfers acquire both owners in a consistent order.
  FOR lock_owner IN
    SELECT DISTINCT key FROM unnest(owner_keys) AS keys(key) ORDER BY key
  LOOP
    INSERT INTO public.threads_hierarchy_locks (owner_key) VALUES (lock_owner)
    ON CONFLICT (owner_key) DO UPDATE
      SET revision = NOT public.threads_hierarchy_locks.revision;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.threads_lock_hierarchy() FROM PUBLIC;
DROP TRIGGER IF EXISTS threads_00_lock_hierarchy ON public.threads;
-- BEFORE row triggers execute alphabetically: acquire the lock before validation.
-- Row locks taken by the invoking statement can still deadlock with another statement;
-- PostgreSQL aborts one transaction safely. Callers must retry the whole transaction
-- on SQLSTATE 40P01 (deadlock) or 40001 (serialization failure).
CREATE TRIGGER threads_00_lock_hierarchy
  BEFORE INSERT OR DELETE OR UPDATE OF id, parent_thread_id, owner_id, subagent_status
  ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.threads_lock_hierarchy();

-- SECURITY DEFINER makes integrity checks independent of caller RLS visibility.
-- All cross-row checks run after acquiring the shared hierarchy mutation lock.
CREATE OR REPLACE FUNCTION public.threads_validate_subagent_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  parent_owner public.threads.owner_id%TYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       AND EXISTS (SELECT 1 FROM public.threads WHERE parent_thread_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot change ownership of a thread with children'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.parent_thread_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO parent_owner
  FROM public.threads WHERE id = NEW.parent_thread_id FOR SHARE;
  IF NOT FOUND OR parent_owner IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'Parent thread not found for this owner'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_thread_id FROM public.threads WHERE id = NEW.parent_thread_id
      UNION
      SELECT p.id, p.parent_thread_id
      FROM public.threads p JOIN ancestors a ON p.id = a.parent_thread_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Thread parent relationship would create a cycle'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.threads_validate_subagent_link() FROM PUBLIC;
DROP TRIGGER IF EXISTS threads_validate_subagent_link ON public.threads;
CREATE TRIGGER threads_validate_subagent_link
  BEFORE INSERT OR UPDATE OF id, parent_thread_id, owner_id ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.threads_validate_subagent_link();

-- Include the target itself so deleting a working child (or deleting several rows
-- in one statement) cannot bypass the descendant check. UNION terminates even if
-- legacy data somehow contains a cycle. No timestamp-based expiry: stale working
-- states deliberately block deletion until explicitly resolved.
CREATE OR REPLACE FUNCTION public.threads_prevent_active_subtree_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE subtree (id, subagent_status) AS (
      SELECT OLD.id, OLD.subagent_status
      UNION
      SELECT child.id, child.subagent_status
      FROM public.threads child JOIN subtree parent ON child.parent_thread_id = parent.id
    )
    SELECT 1 FROM subtree WHERE subagent_status = 'working'
  ) THEN
    RAISE EXCEPTION 'Cannot delete a thread while it or a descendant is working'
      USING ERRCODE = 'check_violation',
            HINT = 'Wait for workers to finish, or cancel them and confirm they have stopped before clearing working status.';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.threads_prevent_active_subtree_delete() FROM PUBLIC;
DROP TRIGGER IF EXISTS threads_prevent_active_subtree_delete ON public.threads;
CREATE TRIGGER threads_prevent_active_subtree_delete
  BEFORE DELETE ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.threads_prevent_active_subtree_delete();

-- After the deletion guard succeeds, SET NULL preserves direct children and their
-- state. If deletion wins the lock before activation, a surviving detached child
-- can subsequently start work independently; a deleted target cannot be activated.
COMMENT ON COLUMN public.threads.parent_thread_id IS
  'Parent thread; null for roots. Any thread may have children. Deletion detaches direct children, but is blocked while this thread or any descendant is working.';
COMMENT ON COLUMN public.threads.subagent_agent_id IS
  'Worker roster slot, unique within a parent. Retained when the thread is detached.';
COMMENT ON COLUMN public.threads.subagent_status IS
  'Worker state: idle | working | done | blocked. Independent of whether this thread has a parent.';
COMMENT ON COLUMN public.threads.subagent_status_at IS
  'When worker status last changed; not an authoritative worker lease.';
COMMENT ON COLUMN public.threads.subagent_heartbeat_baseline IS
  'Encrypted child snapshot from the last true Jev heartbeat; valid on root and nested coordinators.';
COMMENT ON COLUMN public.threads.subagent_heartbeat_digest IS
  'Digest of the last child snapshot Jev evaluated; skips unchanged boards.';
COMMENT ON COLUMN public.threads.subagent_heartbeat_at IS
  'Last Jev heartbeat claim time; optimistic lock for claim/complete.';

COMMIT;

-- Step 2: execute separately, outside a transaction.
-- Supports both slot uniqueness and indexed child-by-parent lookups at every level.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_threads_parent_subagent_slot
  ON public.threads(parent_thread_id, subagent_agent_id)
  WHERE parent_thread_id IS NOT NULL;
