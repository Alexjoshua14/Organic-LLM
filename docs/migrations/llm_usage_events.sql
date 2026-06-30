-- Migration: Per-user LLM usage events for the usage overlay
-- Tracks tokens and computed cost per call for charts and plan allotment views.

CREATE TABLE IF NOT EXISTS llm_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cached_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
  total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  operation TEXT,
  route TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_events_owner_created
  ON llm_usage_events(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_events_owner_model
  ON llm_usage_events(owner_id, model_id);

ALTER TABLE llm_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage events"
  ON llm_usage_events FOR SELECT
  USING (owner_id = current_profile_id());

CREATE POLICY "Users can insert their own usage events"
  ON llm_usage_events FOR INSERT
  WITH CHECK (owner_id = current_profile_id());

-- Existing deployments:
-- ALTER TABLE llm_usage_events ADD COLUMN IF NOT EXISTS cached_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0);
