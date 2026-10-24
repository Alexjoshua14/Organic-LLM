-- Migration: schedule the stale chat-stream sweep from Supabase
--
-- Every 5 minutes, pg_cron POSTs to the app's /api/cron/sweep-stale-streams, which clears
-- threads.active_stream_id markers left by streams that died mid-flight (see
-- lib/chat/stale-stream-sweep.ts). The decision needs Redis — only the app can ask whether a
-- stream is still live — so the database schedules the call rather than clearing rows itself.
--
-- Scheduled here rather than in vercel.json so the 5-minute cadence does not depend on the Vercel
-- plan (Hobby runs crons at most daily) — a stuck marker can block sending until it is cleared.
--
-- Prerequisites (run once, outside version control — never commit the values):
--   select vault.create_secret('https://<production-host>/api/cron/sweep-stale-streams',
--                              'stale_stream_sweep_url');
--   select vault.create_secret('<the app''s CRON_SECRET>', 'cron_secret');
-- CRON_SECRET must also be set in the app's environment; the endpoint is closed without it.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- The sweep reads "threads still marked as streaming, idle longest first". Partial, so it stays
-- tiny: only threads with a marker are indexed.
CREATE INDEX IF NOT EXISTS threads_active_stream_idle_idx
  ON threads (updated_at)
  WHERE active_stream_id IS NOT NULL;

-- Re-running replaces the job of the same name.
SELECT cron.schedule(
  'sweep-stale-chat-streams',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'stale_stream_sweep_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Check recent runs:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- Check responses:     SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 10;
-- Stop the job:        SELECT cron.unschedule('sweep-stale-chat-streams');
