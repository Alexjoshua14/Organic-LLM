-- Migration: Create rabbit_hole_sessions tables for storing Rabbit Hole exploration sessions
-- This migration creates a normalized structure to store all RabbitHoleSession data

-- Main sessions table
CREATE TABLE IF NOT EXISTS rabbit_hole_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  root_question TEXT NOT NULL,
  active_node_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nodes table (stores all nodes in the session)
CREATE TABLE IF NOT EXISTS rabbit_hole_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES rabbit_hole_sessions(session_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  raw_prompt TEXT NOT NULL,
  user_question TEXT NOT NULL,
  key_takeaways TEXT[] NOT NULL CHECK (array_length(key_takeaways, 1) >= 3 AND array_length(key_takeaways, 1) <= 6),
  article_html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, node_id)
);

-- Path segments table (navigation path through nodes)
CREATE TABLE IF NOT EXISTS rabbit_hole_path_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES rabbit_hole_sessions(session_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  label TEXT NOT NULL,
  parent_node_id TEXT,
  position INTEGER NOT NULL,
  UNIQUE(session_id, node_id, position)
);

-- Edges table (graph connections between nodes)
CREATE TABLE IF NOT EXISTS rabbit_hole_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES rabbit_hole_sessions(session_id) ON DELETE CASCADE,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  edge_type TEXT CHECK (edge_type IN ('follow', 'reference', 'source')),
  UNIQUE(session_id, from_node_id, to_node_id)
);

-- Sources table (external sources linked to nodes)
CREATE TABLE IF NOT EXISTS rabbit_hole_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES rabbit_hole_sessions(session_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  favicon_url TEXT,
  snippet TEXT,
  published_date TEXT,
  author TEXT,
  highlights TEXT[],
  -- Analysis data stored as JSONB for flexibility
  analysis JSONB,
  UNIQUE(session_id, node_id, source_id)
);

-- Branch suggestions table (branch suggestions for nodes)
CREATE TABLE IF NOT EXISTS rabbit_hole_branch_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES rabbit_hole_sessions(session_id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  label TEXT NOT NULL,
  short_description TEXT,
  UNIQUE(session_id, node_id, branch_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_sessions_owner_id ON rabbit_hole_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_sessions_session_id ON rabbit_hole_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_sessions_created_at ON rabbit_hole_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rabbit_hole_nodes_session_id ON rabbit_hole_nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_nodes_node_id ON rabbit_hole_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_nodes_session_node ON rabbit_hole_nodes(session_id, node_id);

CREATE INDEX IF NOT EXISTS idx_rabbit_hole_path_segments_session_id ON rabbit_hole_path_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_path_segments_position ON rabbit_hole_path_segments(session_id, position);

CREATE INDEX IF NOT EXISTS idx_rabbit_hole_edges_session_id ON rabbit_hole_edges(session_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_edges_from_node ON rabbit_hole_edges(session_id, from_node_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_edges_to_node ON rabbit_hole_edges(session_id, to_node_id);

CREATE INDEX IF NOT EXISTS idx_rabbit_hole_sources_session_node ON rabbit_hole_sources(session_id, node_id);
CREATE INDEX IF NOT EXISTS idx_rabbit_hole_branch_suggestions_session_node ON rabbit_hole_branch_suggestions(session_id, node_id);

-- RLS Policies
ALTER TABLE rabbit_hole_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rabbit_hole_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rabbit_hole_path_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rabbit_hole_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rabbit_hole_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rabbit_hole_branch_suggestions ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can view their own sessions"
  ON rabbit_hole_sessions FOR SELECT
  USING (owner_id = current_profile_id());

CREATE POLICY "Users can insert their own sessions"
  ON rabbit_hole_sessions FOR INSERT
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can update their own sessions"
  ON rabbit_hole_sessions FOR UPDATE
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

CREATE POLICY "Users can delete their own sessions"
  ON rabbit_hole_sessions FOR DELETE
  USING (owner_id = current_profile_id());

-- Nodes policies (users can only access nodes from their own sessions)
CREATE POLICY "Users can view nodes from their own sessions"
  ON rabbit_hole_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_nodes.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can insert nodes to their own sessions"
  ON rabbit_hole_nodes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_nodes.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can update nodes in their own sessions"
  ON rabbit_hole_nodes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_nodes.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_nodes.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can delete nodes from their own sessions"
  ON rabbit_hole_nodes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_nodes.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

-- Path segments policies
CREATE POLICY "Users can view path segments from their own sessions"
  ON rabbit_hole_path_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_path_segments.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can manage path segments in their own sessions"
  ON rabbit_hole_path_segments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_path_segments.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_path_segments.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

-- Edges policies
CREATE POLICY "Users can view edges from their own sessions"
  ON rabbit_hole_edges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_edges.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can manage edges in their own sessions"
  ON rabbit_hole_edges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_edges.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_edges.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

-- Sources policies
CREATE POLICY "Users can view sources from their own sessions"
  ON rabbit_hole_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_sources.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can manage sources in their own sessions"
  ON rabbit_hole_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_sources.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_sources.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

-- Branch suggestions policies
CREATE POLICY "Users can view branch suggestions from their own sessions"
  ON rabbit_hole_branch_suggestions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_branch_suggestions.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

CREATE POLICY "Users can manage branch suggestions in their own sessions"
  ON rabbit_hole_branch_suggestions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_branch_suggestions.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rabbit_hole_sessions
      WHERE rabbit_hole_sessions.session_id = rabbit_hole_branch_suggestions.session_id
      AND rabbit_hole_sessions.owner_id = current_profile_id()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rabbit_hole_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rabbit_hole_sessions_updated_at
  BEFORE UPDATE ON rabbit_hole_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_rabbit_hole_sessions_updated_at();

-- Comments
COMMENT ON TABLE rabbit_hole_sessions IS 'Main table for Rabbit Hole exploration sessions';
COMMENT ON TABLE rabbit_hole_nodes IS 'Nodes (articles/content) within Rabbit Hole sessions';
COMMENT ON TABLE rabbit_hole_path_segments IS 'Navigation path segments through Rabbit Hole nodes';
COMMENT ON TABLE rabbit_hole_edges IS 'Graph edges connecting Rabbit Hole nodes';
COMMENT ON TABLE rabbit_hole_sources IS 'External sources referenced in Rabbit Hole nodes';
COMMENT ON TABLE rabbit_hole_branch_suggestions IS 'Branch suggestions for exploring deeper into topics';
