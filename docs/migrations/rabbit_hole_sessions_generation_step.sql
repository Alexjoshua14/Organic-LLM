-- Migration: Add generation_step to rabbit_hole_sessions for step visibility and resumability
-- When generating_node_id is set, generation_step indicates which step is running: sources | article | branch_suggestions.
-- Null when no generation or when generation completed.

ALTER TABLE rabbit_hole_sessions
ADD COLUMN IF NOT EXISTS generation_step TEXT NULL;

COMMENT ON COLUMN rabbit_hole_sessions.generation_step IS 'Current generation step: sources, article, or branch_suggestions; null when none or when generation completed.';

-- After applying, regenerate TypeScript types if needed:
--   bun run supabase:types
