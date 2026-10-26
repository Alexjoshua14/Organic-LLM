# Review heartbeat system metrics behind the admin gate

**Status:** Accepted
**Date:** 2026-10-25

## Decision

Extend the [existing content-free telemetry](20261008-heartbeat-telemetry.md) rather than
store snapshots or transcripts. Add nullable working-agent count, snapshot character count,
and snapshot collection duration to raw runs and preserve their samples/sums in hourly rollups.
Working counts use effective status (stale working rows count as blocked), per orchestrator
poll. They are not a globally distinct concurrency measurement. Snapshot characters measure
the formatted PREVIOUS + CURRENT text; decision instructions and provider formatting are
excluded. No tokenizer estimate is presented as actual provider input usage.

`/admin/heartbeats` and `/api/admin/heartbeats` both require a fresh server-side `requireAdmin`
check. The API returns a fixed allowlist of measurements, with private/no-store headers;
owner IDs, thread IDs, generation IDs, snapshot text, raw errors, and provider payloads are
excluded. Database table access and the reporting RPC remain service-role-only; admin browser
sessions cannot query the tables or RPC directly. Failures deny access or report unavailable.

The dashboard queries 1-hour, 24-hour, or 7-day raw windows. SQL computes summary percentiles
across the whole filtered window, not just a page. Individual polls use 50-row pages, ordered
by timestamp and run UUID, anchored to the same window end while paging, up to offset 10,000.
The end may be at most one day old, keeping the entire window inside 10-day raw retention.
Hourly history remains stored but is not displayed here; exact percentiles are unavailable
once raw runs compact. Concurrent late inserts or thread deletion can still shift pages.

Reported evaluation cost and a separate Jev estimate are overlapping diagnostics, never
additive. The supplied Jev rate is $0.04 per million input tokens and zero output cost; it
also replaces the generic fallback in usage accounting for new Jev events. Existing ledger
entries are not rewritten. Missing usage/cost stays null. Estimation uses measured Jev input
only, so it cannot cover provider calls whose usage is missing.

Heartbeat duration starts after authentication/body validation and ends before after-response
queue dispatch and telemetry insertion. It does not measure full network round-trip time or
subsequent orchestrator, tool, and worker execution. A notable run records successful enqueue,
not completed reply delivery. Use the existing usage ledger for billing totals.

## Deployment and validation

Apply `docs/migrations/heartbeat_admin_telemetry.sql` after both existing heartbeat migrations,
**before deploying the new writer**. Otherwise telemetry inserts referencing the new columns
fail best effort, losing diagnostics until the migration is applied. Pause any scheduled cleanup
and let in-flight batches finish while replacing the cleanup function. Resume the existing
schedule afterward; the migration does not create a scheduler. Refresh PostgREST's schema cache
if the new RPC is not yet visible.

No historical measurement is backfilled or invented. Older rows have null new metrics, and
older aggregate buckets have zero new sample counts. The reporting RPC runs with invoker
security, an eight-second statement timeout, validated bounds, and service-role-only EXECUTE.
Missing migrations produce an unavailable message rather than an empty success.

Tests cover auth-before-read, bounded queries, response privacy, null measurements, cost fallback,
working/stale agents, and unchanged-board snapshot measurement. An opt-in transactional database
test verifies migrations, aggregation, compaction, and role permissions when a disposable
PostgreSQL connection is supplied.
