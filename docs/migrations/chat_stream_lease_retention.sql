BEGIN;

-- Apply after chat_stream_subagent_allotment.sql, before deploying callers.
-- Deleting a thread does not cancel in-flight model calls. Retain their lease identities
-- until token-scoped release or expiry so deletion cannot free capacity prematurely.
-- Admission still verifies both thread ownership and existence before inserting a lease.
ALTER TABLE public.chat_stream_leases
  DROP CONSTRAINT IF EXISTS chat_stream_leases_thread_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_stream_leases_parent_thread_id_fkey;

-- owner_id retains its profile FK; these rows remain server-only under existing RLS/grants.
COMMIT;
