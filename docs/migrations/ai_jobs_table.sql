-- Migration: Create ai_jobs table for resumable AI server function execution
-- This table stores jobs that can run even if the user disconnects

CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL DEFAULT current_profile_id() REFERENCES profiles(id) ON DELETE CASCADE,
  function TEXT NOT NULL CHECK (function IN ('generateResponse', 'analyzeContent', 'processRabbitHole', 'summarizeThread', 'extractInsights')),
  parameters JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  result JSONB,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_jobs_owner_id ON ai_jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_priority_status ON ai_jobs(priority DESC, status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at DESC);

-- RLS Policies
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own jobs"
  ON ai_jobs FOR SELECT
  USING (owner_id = current_profile_id());

-- Users can insert their own jobs
CREATE POLICY "Users can insert their own jobs"
  ON ai_jobs FOR INSERT
  WITH CHECK (owner_id = current_profile_id());

-- Users can update their own jobs
CREATE POLICY "Users can update their own jobs"
  ON ai_jobs FOR UPDATE
  USING (owner_id = current_profile_id())
  WITH CHECK (owner_id = current_profile_id());

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_jobs_updated_at
  BEFORE UPDATE ON ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_jobs_updated_at();

-- Comment on table
COMMENT ON TABLE ai_jobs IS 'Queue for AI server functions that can run as resumable streams even if user disconnects';

