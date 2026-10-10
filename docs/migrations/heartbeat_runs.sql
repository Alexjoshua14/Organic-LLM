-- Migration: Content-free heartbeat diagnostics (not a billing ledger).
-- Apply explicitly via the SQL editor or migration pipeline; not auto-applied.
-- Then apply heartbeat_runs_hourly.sql BEFORE scheduling cleanup: it supersedes
-- the original 30-day deletion policy with 10-day raw retention + hourly rollups.
BEGIN;

CREATE TABLE public.heartbeat_runs (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  duration_ms DOUBLE PRECISION NOT NULL CHECK (duration_ms >= 0),
  status TEXT NOT NULL CHECK (status IN (
    'no-subagents', 'unavailable', 'too-soon', 'unchanged', 'claimed-elsewhere',
    'quiet', 'notable', 'error', 'blocked-budget', 'invalid-target'
  )),
  stage TEXT NOT NULL CHECK (stage IN (
    'budget', 'target', 'list-children', 'load-state', 'load-messages', 'claim',
    'evaluate', 'record-usage', 'append-message', 'enqueue-reply', 'complete', 'finished'
  )),
  subagent_count INTEGER CHECK (subagent_count >= 0),
  evaluation_attempted BOOLEAN NOT NULL,
  evaluation_duration_ms DOUBLE PRECISION CHECK (evaluation_duration_ms >= 0),
  event_count INTEGER NOT NULL CHECK (event_count >= 0),
  model_id TEXT,
  input_tokens BIGINT CHECK (input_tokens >= 0),
  output_tokens BIGINT CHECK (output_tokens >= 0),
  total_tokens BIGINT CHECK (total_tokens >= 0),
  cost_usd NUMERIC(18, 10) CHECK (cost_usd >= 0),
  generation_id TEXT,
  provider TEXT,
  error_code TEXT CHECK (error_code IN ('timeout', 'operation-failed'))
);

-- Normal indexes are transaction-safe and appropriate for this new, empty table.
CREATE INDEX idx_heartbeat_runs_started_at ON public.heartbeat_runs (started_at);
CREATE INDEX idx_heartbeat_runs_owner_started_at ON public.heartbeat_runs (owner_id, started_at DESC);
CREATE INDEX idx_heartbeat_runs_thread_started_at ON public.heartbeat_runs (thread_id, started_at DESC);

ALTER TABLE public.heartbeat_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.heartbeat_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.heartbeat_runs TO service_role;
GRANT UPDATE (started_at) ON TABLE public.heartbeat_runs TO service_role;
CREATE POLICY heartbeat_runs_service_role ON public.heartbeat_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.heartbeat_runs IS
  'Best-effort content-free heartbeat diagnostics; cost duplicates usage accounting, never add to billing. Retain 30 days; cleanup must be scheduled separately.';

-- Each call deletes at most 10,000 expired rows, oldest first. Concurrent cleanup
-- workers skip locked rows. Invoker privileges keep this service-role/admin-only.
CREATE FUNCTION public.cleanup_heartbeat_runs(batch_size INTEGER DEFAULT 1000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
SET statement_timeout = '5s'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 10000 THEN
    RAISE EXCEPTION 'batch_size must be between 1 and 10000';
  END IF;

  WITH expired AS (
    SELECT id
    FROM public.heartbeat_runs
    WHERE started_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    ORDER BY started_at, id
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.heartbeat_runs AS runs
  USING expired
  WHERE runs.id = expired.id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_heartbeat_runs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_heartbeat_runs(INTEGER) TO service_role;

COMMIT;

-- RETENTION IS MANUAL UNTIL SCHEDULED. This migration does not install pg_cron
-- or create a job. As service_role/admin, run a bounded batch explicitly:
-- SELECT public.cleanup_heartbeat_runs(1000);
-- Repeat in separate transactions to drain a backlog. Set a caller-side
-- statement_timeout for a hard statement deadline (including lock waits).
--
-- OPTIONAL: If pg_cron is already enabled and approved, run separately as an
-- administrator with table DELETE/SELECT and function EXECUTE privileges:
-- SELECT cron.schedule(
--   'heartbeat-runs-retention', '*/10 * * * *',
--   'SET statement_timeout = ''5s''; SELECT public.cleanup_heartbeat_runs(10000);'
-- );
-- Verify cron.job and cron.job_run_details; do not create duplicate jobs.
-- Monitor expired-row backlog and increase cadence if ingestion outpaces cleanup.
