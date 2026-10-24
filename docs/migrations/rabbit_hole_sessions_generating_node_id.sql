-- Migration: Add generating_node_id to rabbit_hole_sessions for async node generation
-- When set, the session has a node currently being generated; client can poll until null.
-- No FK so the node row may not exist yet when we set it (optimistic session).

ALTER TABLE rabbit_hole_sessions
ADD COLUMN IF NOT EXISTS generating_node_id TEXT NULL;

COMMENT ON COLUMN rabbit_hole_sessions.generating_node_id IS 'Node ID currently being generated (async); null when none or when generation completed.';

-- After applying this migration, regenerate TypeScript types so lib/supabase/types.ts includes generating_node_id:
--   bun run supabase:types
-- or: bunx supabase gen types typescript --linked --schema public > lib/supabase/types.ts
