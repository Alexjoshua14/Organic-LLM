-- Apply after heartbeat_runs.sql and heartbeat_runs_hourly.sql, before deploying the writer.
-- No content is stored. Existing runs retain NULL for unobserved measurements.
BEGIN;
ALTER TABLE public.heartbeat_runs
  ADD COLUMN working_subagent_count INTEGER CHECK (working_subagent_count >= 0 AND working_subagent_count <= subagent_count),
  ADD COLUMN snapshot_chars INTEGER CHECK (snapshot_chars >= 0),
  ADD COLUMN snapshot_duration_ms DOUBLE PRECISION CHECK (snapshot_duration_ms >= 0);

ALTER TABLE public.heartbeat_runs_hourly
  ADD COLUMN working_subagent_samples BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN working_subagent_sum BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN working_subagent_max INTEGER,
  ADD COLUMN snapshot_chars_samples BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN snapshot_chars_sum NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN snapshot_duration_samples BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN snapshot_duration_ms_sum DOUBLE PRECISION NOT NULL DEFAULT 0;

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
      total_tokens_samples, total_tokens_sum, cost_samples, cost_usd_sum,
      working_subagent_samples, working_subagent_sum, working_subagent_max,
      snapshot_chars_samples, snapshot_chars_sum,
      snapshot_duration_samples, snapshot_duration_ms_sum
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
      count(cost_usd), coalesce(sum(cost_usd), 0),
      count(working_subagent_count), coalesce(sum(working_subagent_count), 0), max(working_subagent_count),
      count(snapshot_chars), coalesce(sum(snapshot_chars), 0),
      count(snapshot_duration_ms), coalesce(sum(snapshot_duration_ms), 0)
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
      cost_usd_sum = totals.cost_usd_sum + EXCLUDED.cost_usd_sum,
      working_subagent_samples = totals.working_subagent_samples + EXCLUDED.working_subagent_samples,
      working_subagent_sum = totals.working_subagent_sum + EXCLUDED.working_subagent_sum,
      working_subagent_max = greatest(totals.working_subagent_max, EXCLUDED.working_subagent_max),
      snapshot_chars_samples = totals.snapshot_chars_samples + EXCLUDED.snapshot_chars_samples,
      snapshot_chars_sum = totals.snapshot_chars_sum + EXCLUDED.snapshot_chars_sum,
      snapshot_duration_samples = totals.snapshot_duration_samples + EXCLUDED.snapshot_duration_samples,
      snapshot_duration_ms_sum = totals.snapshot_duration_ms_sum + EXCLUDED.snapshot_duration_ms_sum
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

-- Invoker-security: only service_role may read via the application's fresh admin check.
-- Bounded raw window stays within the 10-day compaction boundary; no misleading
-- percentile calculations from hourly averages and no browser table grants.
CREATE FUNCTION public.read_admin_heartbeat_telemetry(
  p_hours INTEGER DEFAULT 24,
  p_status TEXT DEFAULT 'all',
  p_offset INTEGER DEFAULT 0,
  p_until TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
) RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
SET statement_timeout = '8s'
AS $$
DECLARE result JSONB;
BEGIN
  IF p_hours IS NULL OR p_hours NOT IN (1, 24, 168)
    OR p_offset IS NULL OR p_offset < 0 OR p_offset > 10000
    OR p_until IS NULL OR p_until > CURRENT_TIMESTAMP + INTERVAL '1 minute'
    OR p_until < CURRENT_TIMESTAMP - INTERVAL '1 day'
    OR p_status IS NULL OR p_status NOT IN (
      'all', 'no-subagents', 'unavailable', 'too-soon', 'unchanged', 'claimed-elsewhere',
      'quiet', 'notable', 'error', 'blocked-budget', 'invalid-target'
    ) THEN
    RAISE EXCEPTION 'Invalid telemetry query';
  END IF;

  WITH selected AS MATERIALIZED (
    SELECT id, started_at, status, stage, subagent_count, working_subagent_count,
      duration_ms, evaluation_attempted, evaluation_duration_ms,
      snapshot_chars, snapshot_duration_ms, input_tokens, output_tokens,
      cost_usd, event_count, model_id, provider, error_code
    FROM public.heartbeat_runs
    WHERE started_at >= p_until - make_interval(hours => p_hours)
      AND started_at < p_until
      AND (p_status = 'all' OR status = p_status)
  ), summary AS (
    SELECT jsonb_build_object(
      'runs', count(*),
      'evaluations', count(*) FILTER (WHERE evaluation_attempted),
      'notable', count(*) FILTER (WHERE status = 'notable'),
      'errors', count(*) FILTER (WHERE status = 'error'),
      'input_tokens', sum(input_tokens), 'output_tokens', sum(output_tokens),
      'token_samples', count(input_tokens),
      'input_avg', avg(input_tokens),
      'input_p50', percentile_cont(0.5) WITHIN GROUP (ORDER BY input_tokens),
      'input_p95', percentile_cont(0.95) WITHIN GROUP (ORDER BY input_tokens),
      'input_max', max(input_tokens),
      'duration_p50', percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms),
      'duration_p95', percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms),
      'evaluation_p50', percentile_cont(0.5) WITHIN GROUP (ORDER BY evaluation_duration_ms),
      'evaluation_p95', percentile_cont(0.95) WITHIN GROUP (ORDER BY evaluation_duration_ms),
      'working_avg', avg(working_subagent_count), 'working_max', max(working_subagent_count),
      'working_samples', count(working_subagent_count),
      'snapshot_chars_avg', avg(snapshot_chars),
      'snapshot_duration_avg', avg(snapshot_duration_ms),
      'reported_cost', sum(cost_usd), 'cost_samples', count(cost_usd),
      'jev_estimated_cost', sum(input_tokens) FILTER (WHERE model_id = 'typesafe-ai/jev') * 0.04 / 1000000,
      'jev_estimate_samples', count(input_tokens) FILTER (WHERE model_id = 'typesafe-ai/jev')
    ) AS value FROM selected
  ), statuses AS (
    SELECT status, count(*) AS runs FROM selected GROUP BY status
  ), page AS (
    SELECT id, started_at, status, stage, subagent_count, working_subagent_count,
      duration_ms, evaluation_duration_ms, snapshot_chars, snapshot_duration_ms,
      input_tokens, output_tokens, cost_usd, event_count, model_id, provider, error_code
    FROM selected ORDER BY started_at DESC, id DESC LIMIT 50 OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'summary', (SELECT value FROM summary),
    'statuses', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.runs DESC, s.status) FROM statuses s), '[]'::jsonb),
    'runs', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.started_at DESC, p.id DESC) FROM page p), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.read_admin_heartbeat_telemetry(INTEGER, TEXT, INTEGER, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_admin_heartbeat_telemetry(INTEGER, TEXT, INTEGER, TIMESTAMPTZ)
  TO service_role;
COMMIT;
