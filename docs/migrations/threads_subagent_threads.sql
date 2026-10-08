-- Migration: Arcadia multitask subagent threads + Jev heartbeat state (COA-251)
-- Purpose:
-- - Each multitask subagent gets its own real thread, linked to the orchestrator thread.
-- - parent_thread_id / subagent_agent_id: link a child thread to its orchestrator and roster slot.
-- - subagent_status / subagent_status_at: async worker state read by the dashboard and heartbeat.
-- - subagent_heartbeat_*: on the orchestrator row only. The baseline is the subagent snapshot from
--   the last time the Jev heartbeat fired true (encrypted, it carries message excerpts). The digest
--   is the last snapshot Jev evaluated, so an unchanged board never reaches Jev.
--
-- Notes:
-- - Additive only. Application code degrades when these columns are missing.
-- - status / ids / timestamps are non-sensitive metadata; message content stays in `messages`.
-- - ON DELETE SET NULL keeps child threads when an orchestrator is deleted (cascade is an open
--   question on COA-251). An orphaned child is treated as an ordinary thread.

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS parent_thread_id uuid REFERENCES threads(id) ON DELETE SET NULL;

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS subagent_agent_id text;

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS subagent_status text
    CHECK (subagent_status IS NULL OR subagent_status IN ('idle', 'working', 'done', 'blocked'));

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS subagent_status_at timestamptz;

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS subagent_heartbeat_baseline text;

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS subagent_heartbeat_digest text;

ALTER TABLE threads
  ADD COLUMN IF NOT EXISTS subagent_heartbeat_at timestamptz;

-- One child thread per roster slot per orchestrator.
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_parent_subagent_slot
  ON threads(parent_thread_id, subagent_agent_id)
  WHERE parent_thread_id IS NOT NULL;

COMMENT ON COLUMN threads.parent_thread_id IS
  'Orchestrator thread that owns this subagent thread (Arcadia multitask). Null for ordinary threads.';
COMMENT ON COLUMN threads.subagent_agent_id IS
  'Roster slot id of the subagent this thread belongs to (e.g. agent-researcher).';
COMMENT ON COLUMN threads.subagent_status IS
  'Async worker state: idle | working | done | blocked. A stale working row reads as blocked.';
COMMENT ON COLUMN threads.subagent_heartbeat_baseline IS
  'Encrypted subagent snapshot from the last time the Jev heartbeat returned true (orchestrator row).';
COMMENT ON COLUMN threads.subagent_heartbeat_digest IS
  'Digest of the last subagent snapshot Jev evaluated (orchestrator row). Skips Jev when unchanged.';
