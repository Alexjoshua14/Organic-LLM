-- Migration: anonymous performance metrics and the per-account choice to share them
--
-- Two tables, deliberately unrelated:
--
--   perf_events           anonymous timings. NO profile, user, thread or session column, no URL or
--                         free text, no IP or user agent, and time is bucketed to the hour. The
--                         columns mirror lib/perf/events.ts (PerfEventSchema); the CHECK
--                         constraints below repeat its closed lists so a bug in the app cannot
--                         store anything outside them.
--   perf_metrics_consent  one row per account saying whether new timings may be collected. It is
--                         the only place an account is named, and it holds a boolean and two
--                         timestamps. Nothing joins it to perf_events, and nothing can: events
--                         carry no account key.
--
-- Both tables have row level security on with NO policies, and no access for anon or
-- authenticated. Only the app's server (service role) reads or writes them: the ingest route, the
-- consent route, and the admin dashboard. The summary functions return aggregates only.
--
-- Turning metrics off stops new collection (the ingest route drops events from accounts without
-- an "on" row). It does not delete past numbers, because they carry nothing that could identify
-- whose they were. Old rows are removed by perf_prune() after 90 days.
--
-- Apply once in the Supabase SQL editor. Until it is applied the app collects nothing and the
-- admin dashboard shows "migration pending".

CREATE TABLE IF NOT EXISTS perf_events (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  hour    timestamptz NOT NULL,
  kind    text NOT NULL CHECK (kind IN ('journey', 'phase')),
  journey text NOT NULL CHECK (journey IN ('load', 'to-chat', 'to-arcadia', 'thread-switch', 'launcher-open')),
  phase   text NOT NULL CHECK (char_length(phase) <= 40),
  route   text NOT NULL CHECK (route IN ('/', '/chat/[id]', '/arcadia/[id]', '/arcadia', '/rabbitholes', '/remy', '/speak', '/settings', '/admin', '/sandbox', 'other')),
  trigger text NOT NULL CHECK (trigger IN ('document', 'lets-chat', 'aion-navigate', 'rail-chat', 'rail-arcadia', 'sidebar-thread', 'launcher-shortcut', 'launcher-card', 'link', 'other')),
  device  text NOT NULL CHECK (device IN ('mobile', 'desktop')),
  conn    text NOT NULL CHECK (conn IN ('slow-2g', '2g', '3g', '4g', 'unknown')),
  build   text NOT NULL CHECK (build ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  ms      integer NOT NULL CHECK (ms BETWEEN 0 AND 120000)
);

CREATE INDEX IF NOT EXISTS perf_events_hour_idx ON perf_events (hour DESC);
CREATE INDEX IF NOT EXISTS perf_events_journey_phase_hour_idx ON perf_events (journey, phase, hour DESC);

CREATE TABLE IF NOT EXISTS perf_metrics_consent (
  profile_id uuid PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  enabled    boolean NOT NULL,
  noticed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE perf_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE perf_metrics_consent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON perf_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON perf_metrics_consent FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON perf_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON perf_metrics_consent TO service_role;

-- Percentiles per (journey, phase, kind, route, device) over a window. `within_budget` is the share
-- of samples at or under p_budget_ms. Percentiles are only as trustworthy as `samples`; the
-- dashboard hides p95 below 20 samples and p99 below 100.
CREATE OR REPLACE FUNCTION perf_summary(
  p_since timestamptz,
  p_budget_ms integer DEFAULT 250
)
RETURNS TABLE (
  journey text, phase text, kind text, route text, device text,
  samples bigint, p50 numeric, p75 numeric, p95 numeric, p99 numeric, within_budget numeric
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    e.journey, e.phase, e.kind, e.route, e.device,
    count(*)::bigint,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY e.ms)::numeric,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY e.ms)::numeric,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY e.ms)::numeric,
    percentile_cont(0.99) WITHIN GROUP (ORDER BY e.ms)::numeric,
    (count(*) FILTER (WHERE e.ms <= p_budget_ms))::numeric / count(*)
  FROM perf_events e
  WHERE e.hour >= p_since
  GROUP BY e.journey, e.phase, e.kind, e.route, e.device
$$;

-- Daily trend of whole-journey timings, for the dashboard's sparkline.
CREATE OR REPLACE FUNCTION perf_daily(p_since timestamptz)
RETURNS TABLE (day date, journey text, samples bigint, p50 numeric, p95 numeric)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    (e.hour AT TIME ZONE 'UTC')::date, e.journey, count(*)::bigint,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY e.ms)::numeric,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY e.ms)::numeric
  FROM perf_events e
  WHERE e.hour >= p_since AND e.kind = 'journey'
  GROUP BY 1, 2
  ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION perf_prune(p_keep interval DEFAULT interval '90 days')
RETURNS bigint
LANGUAGE sql SECURITY INVOKER AS $$
  WITH gone AS (DELETE FROM perf_events WHERE hour < now() - p_keep RETURNING 1)
  SELECT count(*)::bigint FROM gone
$$;

REVOKE EXECUTE ON FUNCTION perf_summary(timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION perf_daily(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION perf_prune(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION perf_summary(timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION perf_daily(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION perf_prune(interval) TO service_role;

-- Optional: prune nightly with pg_cron (run once).
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('prune-perf-events', '17 3 * * *', $$SELECT perf_prune()$$);
