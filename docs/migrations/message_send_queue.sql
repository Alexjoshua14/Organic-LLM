-- Migration: Persistent multi-mode message send queue
-- Client enqueues; server dispatches when the target thread is idle and plan budget allows.
-- Apply in Supabase SQL editor or your migration pipeline. Not auto-applied by the app.

CREATE TABLE IF NOT EXISTS message_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  -- Optional multitask / subagent target id (opaque to this table).
  target_agent_id TEXT,
  body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 100000),
  -- Composer / chat request hints (model, effort, experience, toggles). No secrets.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- FIFO within a thread: lower position sends first. Assigned at insert.
  position BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'blocked_streaming',
      'blocked_budget',
      'dispatching',
      'sent',
      'failed',
      'cancelled'
    )),
  hold_reason TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_message_send_queue_owner_status
  ON message_send_queue(owner_id, status, position ASC);

CREATE INDEX IF NOT EXISTS idx_message_send_queue_thread_status
  ON message_send_queue(thread_id, status, position ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_send_queue_thread_position
  ON message_send_queue(thread_id, position);

ALTER TABLE message_send_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queued messages"
  ON message_send_queue FOR SELECT
  USING (owner_id = current_profile_id());

CREATE POLICY "Users can insert their own queued messages"
  ON message_send_queue FOR INSERT
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can update their own queued messages"
  ON message_send_queue FOR UPDATE
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can delete their own queued messages"
  ON message_send_queue FOR DELETE
  USING (owner_id = current_profile_id());

CREATE OR REPLACE FUNCTION update_message_send_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_message_send_queue_updated_at ON message_send_queue;
CREATE TRIGGER update_message_send_queue_updated_at
  BEFORE UPDATE ON message_send_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_message_send_queue_updated_at();

COMMENT ON TABLE message_send_queue IS
  'Multi-mode composer queue: client enqueues, server dispatches when thread idle and plan budget allows';
