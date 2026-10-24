-- Link each rabbit hole session to one continuous chat thread.
ALTER TABLE rabbit_hole_sessions
  ADD COLUMN IF NOT EXISTS chat_thread_id UUID REFERENCES threads(id) ON DELETE SET NULL;

COMMENT ON COLUMN rabbit_hole_sessions.chat_thread_id IS 'Persistent chat thread for drawer/sidebar assistant (one per session).';

CREATE INDEX IF NOT EXISTS idx_rabbit_hole_sessions_chat_thread_id
  ON rabbit_hole_sessions(chat_thread_id);
