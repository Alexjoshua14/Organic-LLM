-- Apply AFTER heartbeat_runs.sql, whether or not its cleanup job was scheduled.
-- Replaces that cleanup function in place: existing jobs now roll up instead of discard.
-- If old cleanup is scheduled, pause it and let any in-flight run finish before
-- applying. Data already deleted by the old 30-day policy cannot be recovered here.
BEGIN;

CREATE TABLE public.heartbeat_runs_hourly (
  hour_start TIMESTAMPTZ NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  -- Empty strings represent unreported dimensions, making the aggregate key non-null.
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  error_code TEXT NOT NULL,
  run_count BIGINT NOT NULL CHECK (run_count > 0),
  duration_ms_sum DOUBLE PRECISION NOT NULL,
  duration_ms_max DOUBLE PRECISION NOT NULL,
  evaluation_count BIGINT NOT NULL,
  evaluation_duration_count BIGINT NOT NULL,
  evaluation_duration_ms_sum DOUBLE PRECISION NOT NULL,
  evaluation_duration_ms_max DOUBLE PRECISION,
  subagent_count_samples BIGINT NOT NULL,
  subagent_count_sum BIGINT NOT NULL,
  event_count_sum BIGINT NOT NULL,
  input_tokens_samples BIGINT NOT NULL,
  input_tokens_sum NUMERIC NOT NULL,
  output_tokens_samples BIGINT NOT NULL,
  output_tokens_sum NUMERIC NOT NULL,
  total_tokens_samples BIGINT NOT NULL,
  total_tokens_sum NUMERIC NOT NULL,
  cost_samples BIGINT NOT NULL,
  cost_usd_sum NUMERIC NOT NULL,
  PRIMARY KEY (hour_start, owner_id, status, stage, model_id, provider, error_code)
);

-- SELECT FOR UPDATE requires UPDATE privilege on at least one source column.
GRANT UPDATE (started_at) ON TABLE public.heartbeat_runs TO service_role;

CREATE INDEX idx_heartbeat_runs_hourly_owner_hour
  ON public.heartbeat_runs_hourly (owner_id, hour_start DESC);
ALTER TABLE public.heartbeat_runs_hourly ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.heartbeat_runs_hourly FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.heartbeat_runs_hourly TO service_role;
CREATE POLICY heartbeat_runs_hourly_service_role ON public.heartbeat_runs_hourly
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.heartbeat_runs_hourly IS
  'UTC hourly heartbeat diagnostics older than 10 days, grouped by owner/status/stage/model/provider/error. Counts and sums support weighted averages. No thread IDs or content. No automatic expiry of summaries; profile deletion cascades.';
COMMENT ON TABLE public.heartbeat_runs IS
  'Best-effort content-free heartbeat diagnostics, not billing. Keep at least 10 days raw; scheduled cleanup atomically moves older rows into heartbeat_runs_hourly.';

CREATE OR REPLACE FUNCTION public.cleanup_heartbeat_runs(batch_size INTEGER DEFAULT 1000)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
SET statement_timeout = '5s'
AS $$
DECLARE
  moved_count INTEGER;
BEGIN
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 10000 THEN
    RAISE EXCEPTION 'batch_size must be between 1 and 10000';
  END IF;

  -- Serialize rollup writers without waiting, avoiding aggregate-row upsert deadlocks.
  IF NOT pg_try_advisory_xact_lock(72418, 1) THEN
    RETURN 0;
  END IF;

  WITH expired AS (
    SELECT id FROM public.heartbeat_runs
    WHERE started_at < CURRENT_TIMESTAMP - INTERVAL '10 days'
    ORDER BY started_at, id
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  ), moved AS (
    DELETE FROM public.heartbeat_runs AS runs USING expired
    WHERE runs.id = expired.id
    RETURNING runs.*
  ), rolled_up AS (
    INSERT INTO public.heartbeat_runs_hourly AS totals (
      hour_start, owner_id, status, stage, model_id, provider, error_code,
      run_count, duration_ms_sum, duration_ms_max,
      evaluation_count, evaluation_duration_count, evaluation_duration_ms_sum, evaluation_duration_ms_max,
      subagent_count_samples, subagent_count_sum, event_count_sum,
      input_tokens_samples, input_tokens_sum, output_tokens_samples, output_tokens_sum,
      total_tokens_samples, total_tokens_sum, cost_samples, cost_usd_sum
    )
    SELECT
      date_trunc('hour', started_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
      owner_id, status, stage, coalesce(model_id, ''), coalesce(provider, ''), coalesce(error_code, ''),
      count(*), sum(duration_ms), max(duration_ms),
      count(*) FILTER (WHERE evaluation_attempted), count(evaluation_duration_ms),
      coalesce(sum(evaluation_duration_ms), 0), max(evaluation_duration_ms),
      count(subagent_count), coalesce(sum(subagent_count), 0), sum(event_count),
      count(input_tokens), coalesce(sum(input_tokens), 0),
      count(output_tokens), coalesce(sum(output_tokens), 0),
      count(total_tokens), coalesce(sum(total_tokens), 0),
      count(cost_usd), coalesce(sum(cost_usd), 0)
    FROM moved
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    ON CONFLICT (hour_start, owner_id, status, stage, model_id, provider, error_code)
    DO UPDATE SET
      run_count = totals.run_count + EXCLUDED.run_count,
      duration_ms_sum = totals.duration_ms_sum + EXCLUDED.duration_ms_sum,
      duration_ms_max = greatest(totals.duration_ms_max, EXCLUDED.duration_ms_max),
      evaluation_count = totals.evaluation_count + EXCLUDED.evaluation_count,
      evaluation_duration_count = totals.evaluation_duration_count + EXCLUDED.evaluation_duration_count,
      evaluation_duration_ms_sum = totals.evaluation_duration_ms_sum + EXCLUDED.evaluation_duration_ms_sum,
      evaluation_duration_ms_max = greatest(totals.evaluation_duration_ms_max, EXCLUDED.evaluation_duration_ms_max),
      subagent_count_samples = totals.subagent_count_samples + EXCLUDED.subagent_count_samples,
      subagent_count_sum = totals.subagent_count_sum + EXCLUDED.subagent_count_sum,
      event_count_sum = totals.event_count_sum + EXCLUDED.event_count_sum,
      input_tokens_samples = totals.input_tokens_samples + EXCLUDED.input_tokens_samples,
      input_tokens_sum = totals.input_tokens_sum + EXCLUDED.input_tokens_sum,
      output_tokens_samples = totals.output_tokens_samples + EXCLUDED.output_tokens_samples,
      output_tokens_sum = totals.output_tokens_sum + EXCLUDED.output_tokens_sum,
      total_tokens_samples = totals.total_tokens_samples + EXCLUDED.total_tokens_samples,
      total_tokens_sum = totals.total_tokens_sum + EXCLUDED.total_tokens_sum,
      cost_samples = totals.cost_samples + EXCLUDED.cost_samples,
      cost_usd_sum = totals.cost_usd_sum + EXCLUDED.cost_usd_sum
    RETURNING 1
  )
  SELECT count(*)::INTEGER INTO moved_count FROM moved;

  -- DELETE and aggregate upsert are one statement/transaction: failures restore raw rows.
  -- Partial batches and late arrivals add to existing buckets, never average averages.
  RETURN moved_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_heartbeat_runs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_heartbeat_runs(INTEGER) TO service_role;
COMMIT;

-- AUTOMATION: enable Supabase Cron (pg_cron) in the dashboard first, then run
-- this separately as postgres (or service_role with cron access). A custom cron
-- role also needs raw SELECT/DELETE/column UPDATE, summary SELECT/INSERT/UPDATE,
-- appropriate RLS access, and function EXECUTE privileges. Named cron.schedule updates an existing
-- job of the same name for that database user; do not also run a raw DELETE job.
-- SELECT cron.schedule(
--   'heartbeat-runs-retention', '*/10 * * * *',
--   'SET statement_timeout = ''5s''; SELECT public.cleanup_heartbeat_runs(10000);'
-- );
-- The existing same-named job from heartbeat_runs.sql works unchanged.
-- Without a scheduler, run SELECT public.cleanup_heartbeat_runs(10000); manually.
-- One batch every ten minutes handles up to 1.44M rows/day; monitor backlog and
-- increase cadence if needed. A timeout rolls back the entire batch; reduce batch
-- size or adjust the caller-side timeout based on measured performance.
