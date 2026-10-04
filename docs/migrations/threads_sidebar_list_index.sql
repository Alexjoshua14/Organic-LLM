-- Migration: Index for the paged sidebar thread list (GET /api/chats)
-- data/supabase/sidebar-threads.ts filters by owner_id and orders by updated_at desc, id desc,
-- keyset-paged on (updated_at, id). This index serves the filter, the order, and the cursor
-- as one range scan, so a page costs the same at 20 threads or 2,000.
--
-- CONCURRENTLY avoids locking writes; it cannot run inside a transaction block.

CREATE INDEX CONCURRENTLY IF NOT EXISTS threads_owner_updated_id_idx
  ON threads (owner_id, updated_at DESC, id DESC);

-- Verify (replace the owner id). Expect an Index Scan on threads_owner_updated_id_idx and no
-- Sort node. If the plan shows a per-row subquery from an RLS policy, wrap the policy's
-- lookup as (select ...) so Postgres evaluates it once per query instead of once per row.
--
-- EXPLAIN ANALYZE
-- SELECT id, title, owner_id, created_at, updated_at, pinned, feature, path
-- FROM threads
-- WHERE owner_id = '<owner-uuid>'
--   AND pinned IS NOT TRUE
--   AND feature = 'main'
-- ORDER BY updated_at DESC, id DESC
-- LIMIT 51;
