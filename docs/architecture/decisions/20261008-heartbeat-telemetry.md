# Persist content-free heartbeat telemetry in Supabase

**Status:** Accepted
**Date:** 2026-10-08
**Affects:** `data/supabase/heartbeat-runs.ts`, `lib/llm/subagents/heartbeat/telemetry.ts`, heartbeat polling, `docs/migrations/heartbeat_runs.sql`, `docs/migrations/heartbeat_runs_hourly.sql`

## Context

Heartbeat evaluation metrics alone cannot explain skipped polls, budget rejection, invalid targets, or failures before evaluation. Operators need status counts, latency, and evaluation-cost diagnostics without retaining prompts, messages, model output, or arbitrary provider metadata.

## Decision

- Attempt one `heartbeat_runs` row for each authenticated poll with a validated request body, including skips. Ownership/authentication failures and schema-invalid bodies are excluded. The existing route treats unparseable JSON as an empty preferences object, so those requests can still be recorded. Capture starts before budget and target checks, so `blocked-budget`, `invalid-target`, and pre-evaluation errors are covered, not just model calls.
- Persist after the response using the server's after-response lifecycle. The writer is best effort, catches thrown and returned insert failures, uses a 3,000 ms insert abort signal, and logs only a fixed warning plus run UUID. It does not retry or change the heartbeat response. Process termination, timeout, database outages, or deleted/missing FK targets can lose rows: this is not an audit guarantee. `invalid-target` means an owned child thread rejected by the route; nonexistent/unowned threads are rejected before telemetry starts.
- Use the existing untyped `supabaseAdmin` client and import `HeartbeatRunTelemetry` from the heartbeat module. Keep the insert field allowlist explicit; do not edit generated database types. Caller-supplied run IDs are UUIDs, owner IDs are profile text IDs, thread IDs are UUIDs, and `started_at` is an ISO timestamp stored as `timestamptz`.
- Store duration, terminal status/stage, nullable child count, evaluation-attempt flag and nullable evaluation duration, event count, and nullable model/token/cost/generation/provider identifiers. Unknown or unobserved measurements stay null, not fabricated zeros. `provider` is only the provider identifier, never its metadata. No content, raw errors, stack traces, or payloads are stored. `error_code` is only `timeout`, `operation-failed`, or null.
- Status is one of `no-subagents`, `unavailable`, `too-soon`, `unchanged`, `claimed-elsewhere`, `quiet`, `notable`, `error`, `blocked-budget`, or `invalid-target`. Stage locates the terminal operation: `budget`, `target`, `list-children`, `load-state`, `load-messages`, `claim`, `evaluate`, `record-usage`, `append-message`, `enqueue-reply`, `complete`, or `finished`. A failure after evaluation may still have evaluation usage; do not restrict diagnostic cost queries to successful statuses.
- Successful orchestrator reply enqueue means the reply was queued, **not** that reply generation or delivery completed. Heartbeat completion is not downstream job completion.
- Evaluation cost is a diagnostic duplicate of existing usage accounting, not a new charge or billing source. Keep `llm_usage_events` as the billing source; never sum the two tables together. Heartbeat cost excludes subsequent orchestrator reply generation and may be missing even when a provider incurred cost.
- Enable RLS and grant application access only to `service_role`; explicitly revoke `PUBLIC`, `anon`, and `authenticated`. Privileged database administrators remain able to operate the table. Profile/thread deletion cascades. Index start time and owner/thread plus start time for time-window investigation and retention.

## Retention and consequences

Keep at least **10 days of raw rows**, then compact older rows into `heartbeat_runs_hourly`. This supersedes the original migration's 30-day deletion-only policy. Hourly summaries are retained indefinitely for now; profile deletion cascades to them. They contain no thread IDs or gateway generation IDs, so deleting one thread cannot selectively remove its contribution after aggregation. Raw rows still cascade on thread deletion.

Buckets use UTC hour plus owner, status, terminal stage, model, provider, and error code. Unknown model/provider/error dimensions use an empty string. Store sums and sample counts rather than averages: combine buckets using `sum(duration_ms_sum) / sum(run_count)`, not an average of hourly averages. Nullable metrics have separate sample counts; no reported cost is not the same as zero cost. Preserve maximum duration, event counts, evaluation attempts, tokens, and cost for spike analysis. Exact percentiles, individual-run drilldown, distinct-thread counts, and per-thread deletion are no longer available once rolled up.

`cleanup_heartbeat_runs(batch_size)` atomically deletes/returns at most 10,000 eligible raw rows (default 1,000) and upserts their aggregates in one statement. Any aggregate failure rolls the deletion back. Subsequent batches and late arrivals add to the bucket; retries after success cannot double-count removed source rows. A transaction-scoped advisory lock serializes cleanup workers without waiting, and locked raw rows are skipped. A return of zero may mean no eligible rows, a competing worker, or locked rows; monitor backlog rather than assuming zero means fully drained. The function is invoker-security, service-role/admin only; raw-row locking requires the explicit column UPDATE grant in the migrations.

**Retention is manual until an operator schedules cleanup.** Enable Supabase Cron (`pg_cron`) and run the commented scheduling command in `heartbeat_runs_hourly.sql`, or use an external scheduler. Existing `heartbeat-runs-retention` jobs call the same replaced function. Pause the old job and wait for in-flight runs before upgrading; already-deleted raw data cannot be recovered. Use postgres/service-role or grant a custom scheduler role all required privileges and RLS access. Ten days is the eligibility boundary, not guaranteed deletion at the exact expiry instant. Batches of 10,000 every ten minutes compact at most 1.44M rows/day; adjust cadence or batch size and caller-side timeout based on observed backlog and runtime. Hourly summaries keep growing, although at lower granularity.

Every validated poll, including cheap skips, adds a row and three secondary index entries. Monitor table/index size, poll rate, and cleanup lag. If volume makes Postgres telemetry expensive, move this workload to external telemetry with equivalent privacy and retention controls rather than expanding the billing ledger. Missing best-effort rows mean counts, percentiles, and costs describe observed runs only.

## Setup

1. Apply `docs/migrations/heartbeat_runs.sql` once, then `docs/migrations/heartbeat_runs_hourly.sql` once, via the approved SQL editor or migration pipeline. If the first migration is already applied, only run the second. Both use transaction-safe normal indexes on new empty tables. No migration is run by the application.
2. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Verify an admin/service-role insert and query succeed and `anon`/`authenticated` table access and cleanup execution are denied. Use an existing profile/thread pair for the insert; verify cascade behavior in a disposable test environment.
3. Exercise skipped, quiet/notable, budget-blocked, invalid-target, and pre-evaluation error paths. Confirm after-response rows where FKs are valid; simulate insert failure and confirm unchanged responses and warnings containing no payload/error text.
4. Run `SELECT public.cleanup_heartbeat_runs(1000);` as service role/admin under a caller-side timeout. Repeat bounded calls in separate transactions for backlog. Enable Supabase Cron, then execute the optional schedule in `heartbeat_runs_hourly.sql` separately; verify `cron.job` and `cron.job_run_details`. Otherwise use an external scheduler or manual cleanup. Validate in a disposable database that recent rows remain, old rows merge correctly across batches, repeat calls do not double-count, and a failed aggregate insert restores the source rows.

## Operational SQL (service role/admin)

Status counts and observed handler p95 latency (excluding authentication, body parsing, after-response persistence, and downstream queue dispatch) for the last 24 hours (including skips and errors):

```sql
SELECT status, count(*) AS runs,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms
FROM public.heartbeat_runs
WHERE started_at >= now() - interval '24 hours'
GROUP BY status
ORDER BY runs DESC;
```

Evaluation-only diagnostics, including failed runs that attempted evaluation. Null cost remains unknown; `runs_with_cost` makes coverage visible. **Do not add these totals to `llm_usage_events` or treat them as billing.**

```sql
SELECT model_id, provider, count(*) AS evaluation_attempts,
       count(cost_usd) AS runs_with_cost,
       sum(cost_usd) AS observed_evaluation_cost_usd,
       sum(input_tokens) AS observed_input_tokens,
       sum(output_tokens) AS observed_output_tokens,
       percentile_cont(0.95) WITHIN GROUP (
         ORDER BY evaluation_duration_ms
       ) AS p95_evaluation_duration_ms
FROM public.heartbeat_runs
WHERE started_at >= now() - interval '24 hours'
  AND evaluation_attempted
GROUP BY model_id, provider
ORDER BY observed_evaluation_cost_usd DESC NULLS LAST;
```

Retention backlog (must trend toward zero after cleanup):

```sql
SELECT count(*) AS expired_runs, min(started_at) AS oldest_expired_run
FROM public.heartbeat_runs
WHERE started_at < now() - interval '10 days';
```

Hourly history with weighted averages and observed cost coverage:

```sql
SELECT hour_start, status,
       sum(run_count) AS runs,
       sum(evaluation_count) AS evaluations,
       sum(event_count_sum) AS events,
       sum(duration_ms_sum) / nullif(sum(run_count), 0) AS avg_duration_ms,
       max(duration_ms_max) AS max_duration_ms,
       sum(evaluation_duration_ms_sum)
         / nullif(sum(evaluation_duration_count), 0) AS avg_evaluation_ms,
       sum(cost_samples) AS runs_with_cost,
       CASE WHEN sum(cost_samples) > 0 THEN sum(cost_usd_sum) END AS observed_cost_usd
FROM public.heartbeat_runs_hourly
WHERE hour_start >= now() - interval '90 days'
GROUP BY hour_start, status
ORDER BY hour_start DESC, status;
```

For a combined raw + hourly dashboard, union raw aggregates with hourly rows in **one SQL statement** and sum their counts/totals before dividing. Include all retained raw rows, not only those newer than ten days: older rows may be awaiting compaction. Do not assume a bucket is final; batches and late arrivals can update it. A single statement observes an atomic snapshot so a concurrently moved row is neither lost nor counted twice.
