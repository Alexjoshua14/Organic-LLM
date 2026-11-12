# Performance metrics

Anonymous production timings, so the owner can tell whether the things designed to feel instant
(budget: 250 ms) really are. Tracked in COA-602. Journey and phase names live in
[perf-journeys](./perf-journeys.md); this page covers what leaves the browser, what is stored,
who can see it, and how a person opts out.

**Code:** [`events.ts`](../lib/perf/events.ts) (the schema) ·
[`report.ts`](../lib/perf/report.ts) (browser) ·
[`consent.ts`](../lib/perf/consent.ts) (the account's choice) ·
[`/api/perf/ingest`](../app/api/perf/ingest/route.ts) ·
[`/api/perf/consent`](../app/api/perf/consent/route.ts) ·
[`perf-metrics.ts`](../data/supabase/perf-metrics.ts) (tables) ·
[`summary-core.ts`](../lib/perf/summary-core.ts) and
[`/admin/performance`](../app/admin/performance/page.tsx) (reading) ·
[migration](./migrations/perf_metrics.sql)

## What is collected: privacy by construction

One schema, [`PerfEventSchema`](../lib/perf/events.ts), is the only shape a measurement can take. The
browser builds events from it, the ingest route validates against it with `.strict()`, the
database columns and `CHECK` constraints mirror it, and the notice users read renders
`PERF_DISCLOSURE` from it. A test asserts the disclosed list equals the schema's keys plus the
server-set `hour`, so the notice cannot claim less than what is stored.

| Field | Values |
|-------|--------|
| `ms` | integer, 0 to 120000 |
| `journey`, `phase`, `kind` | closed lists from `journeys.ts` (whole action or one step) |
| `route` | a route *template* from a closed list (`/chat/[id]`), never a path |
| `trigger` | a closed list (`sidebar-thread`, `lets-chat`, …) |
| `device`, `conn` | `mobile`/`desktop`; connection class |
| `build` | app version, `x.y.z` only |
| `hour` | set by the server, truncated to the hour |

**Absent on purpose:** any account, profile, session, thread or message id; any URL, query string
or free text; IP address; user agent; any client-supplied timestamp; mark `detail` objects.
`perfRouteTemplate` and `perfTriggerKind` collapse anything id-bearing to a list member, and the
reporter drops every event the schema rejects. Rows have **no account column**, so a stored
measurement cannot be tied to a person even by someone with full database access.

Honest limits: the host's own request logs (IP, timing of requests) exist for any web app and are
outside this table. With very few users, the combination of device, build and hour can narrow who
a row came from; that is why time is bucketed to the hour and nothing finer is kept.

## Consent

- **Account level, server enforced.** `perf_metrics_consent` holds one boolean per account. The
  ingest route drops events from any account that is not `on`. No row, no table, or a failed read
  all mean *do not collect*.
- **First run.** When no choice exists, the notice appears; collection starts only after it has
  painted (the account is then recorded as `on`). "Turn off" stops it at once.
- **Settings → Privacy** has the toggle. Turning it off stops new collection on every device.
  Past numbers are *not* deleted, by design: they carry nothing that says whose they were, so
  there is nothing to find. They are pruned after 90 days (`perf_prune()`).
- The client keeps an `"on"` hint in localStorage per account only so the first page view of a
  visit is not missed while the server answers. The server answer overrides it, and nothing in it
  is ever sent.
- Local collection for the `?perf=1` HUD never reports; reporting needs consent.

## Security

- **Ingest:** Clerk session required (the proxy protects `/api/*`), cross-site requests refused
  (`Sec-Fetch-Site` / `Origin`), body capped at 8 KB before parsing, 600 requests/hour/user
  (the limiter key is the authenticated id and is not stored with a metric), strict schema, body
  and headers never logged, service-role insert. A missing table returns 204 so the app never breaks.
- **Tables:** row level security on, **no policies**, no access for `anon`/`authenticated`;
  only the server's service role reads or writes. The summary functions are `service_role` only.
- **Reading:** `requireAdmin()` in the admin layout *and* in the page itself. The page reads only
  the percentile functions, so no event, account or thread is ever loaded into it.
- Percentiles are shown only with enough samples: p95 needs 20, p99 needs 100; below that the row
  says "Not enough data" rather than reporting the worst single event as a percentile.

## Operating it

1. Apply [`docs/migrations/perf_metrics.sql`](./migrations/perf_metrics.sql) in Supabase. Until
   then the app collects nothing and the dashboard shows "migration pending".
2. Optionally schedule `perf_prune()` nightly (statement at the end of the migration).
3. Budgets live in [`budgets.ts`](../lib/perf/budgets.ts): one default (250 ms), per-journey
   overrides. Change a target there, with the reason, never to flatter a number.

## Adding a metric

Add the journey or phase name to `journeys.ts`, start/complete it with `startJourney` /
`completeForJourney`, extend the `CHECK` lists in a new migration, and add a test. Never add a
free-text or id-bearing field: the schema test will fail the build.

## Not covered yet

- INP/CLS and other Web Vitals need a dependency (`web-vitals`) or a careful local implementation.
- Server-side phase rows (e.g. `loadChat`) are reported with the journey that triggered them, so
  they are only as complete as the journey that carried them.
- Launcher open/card journeys are wired once the launcher PR lands.
- An agent-readable aggregates endpoint needs a proxy exemption and is awaiting approval.
