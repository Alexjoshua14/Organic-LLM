-- Migration: sidebar attention — per-thread "new since last look" state, the one-query status
-- overlay, and the indexes the sidebar's two queries use.
-- Decision: docs/architecture/decisions/20260924-sidebar-seen-state.md
--
-- Lives beside `threads`, not on it: every write to `threads` advances `updated_at`, which
-- orders the sidebar. Marking a thread seen must not move it to the top of the list.
--
-- last_activity_at — set by the server when content lands (assistant turn saved, rabbit-hole
--                    node completed). Never set for Speak; voice is realtime.
-- last_seen_at     — set when the thread is on screen in a visible tab. Synced across devices.
-- unseen           — derived; the sidebar asks only for rows where it is true.

CREATE TABLE IF NOT EXISTS thread_attention (
  thread_id UUID PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
  -- UUID, matching profiles.id (verified against the live schema 2026-09-25).
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  last_activity_at TIMESTAMPTZ NULL,
  last_seen_at TIMESTAMPTZ NULL,
  unseen BOOLEAN GENERATED ALWAYS AS (
    last_activity_at IS NOT NULL
    AND (last_seen_at IS NULL OR last_activity_at > last_seen_at)
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_thread_attention_owner_unseen
  ON thread_attention(owner_id)
  WHERE unseen;

-- Sidebar "working" lookup: recent streams only.
CREATE INDEX IF NOT EXISTS idx_threads_owner_active_stream_started
  ON threads(owner_id, active_stream_started_at)
  WHERE active_stream_started_at IS NOT NULL;

-- Sidebar thread list: one owner's non-archived threads, newest first. The predicate matches
-- the list query's `archived IS NOT TRUE`, so archived rows are never read.
CREATE INDEX IF NOT EXISTS idx_threads_owner_updated_unarchived
  ON threads(owner_id, updated_at DESC)
  WHERE archived IS NOT TRUE;

-- Rabbit-hole working lookup: sessions mid-generation.
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_sessions_owner_generating
  ON rabbit_hole_sessions(owner_id, updated_at)
  WHERE generating_node_id IS NOT NULL;

ALTER TABLE thread_attention ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own thread attention"
  ON thread_attention FOR SELECT
  USING (owner_id = current_profile_id());

-- The thread must also belong to the caller, so a row cannot be claimed for someone else's thread.
CREATE POLICY "Users can insert their own thread attention"
  ON thread_attention FOR INSERT
  WITH CHECK (
    owner_id = current_profile_id()
    AND EXISTS (
      SELECT 1 FROM threads t
      WHERE t.id = thread_attention.thread_id AND t.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can update their own thread attention"
  ON thread_attention FOR UPDATE
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

-- Status overlay in one statement (GET /api/chats/activity): threads with unseen content,
-- threads streaming a reply, and rabbit holes generating a node, each working marker ignored
-- once older than p_since. SECURITY INVOKER: RLS still limits rows to the caller.
CREATE OR REPLACE FUNCTION sidebar_thread_attention(p_owner_id UUID, p_since TIMESTAMPTZ)
RETURNS TABLE (thread_id UUID, unseen BOOLEAN, working BOOLEAN, generation_step TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH unseen_threads AS (
    SELECT ta.thread_id
    FROM thread_attention ta
    WHERE ta.owner_id = p_owner_id AND ta.unseen
  ),
  streaming_threads AS (
    SELECT t.id AS thread_id
    FROM threads t
    WHERE t.owner_id = p_owner_id AND t.active_stream_started_at > p_since
  ),
  generating_threads AS (
    SELECT DISTINCT ON (s.chat_thread_id) s.chat_thread_id AS thread_id, s.generation_step
    FROM rabbit_hole_sessions s
    WHERE s.owner_id = p_owner_id
      AND s.generating_node_id IS NOT NULL
      AND s.chat_thread_id IS NOT NULL
      AND s.updated_at > p_since
    ORDER BY s.chat_thread_id, s.updated_at DESC
  ),
  attention AS (
    SELECT thread_id FROM unseen_threads
    UNION SELECT thread_id FROM streaming_threads
    UNION SELECT thread_id FROM generating_threads
  )
  SELECT
    a.thread_id,
    EXISTS (SELECT 1 FROM unseen_threads u WHERE u.thread_id = a.thread_id) AS unseen,
    (g.thread_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM streaming_threads st WHERE st.thread_id = a.thread_id)) AS working,
    g.generation_step
  FROM attention a
  LEFT JOIN generating_threads g ON g.thread_id = a.thread_id;
$$;

REVOKE ALL ON FUNCTION sidebar_thread_attention(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sidebar_thread_attention(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON TABLE thread_attention IS 'Sidebar attention per thread: last content activity vs last time the owner saw it.';
COMMENT ON COLUMN thread_attention.unseen IS 'True when content landed after the owner last saw the thread.';

-- After applying, regenerate TypeScript types if needed:
--   bun run supabase:types
