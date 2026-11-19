# Agent test account

How an AI coding agent signs in to a local Organic LLM to check its work, and what that
account can and cannot do.

## What the account is

A normal Clerk user whose id is listed in `AGENT_TEST_CLERK_USER_IDS`. That list, and only
that list, makes an account an agent account. While listed, it gets:

| Limit | Value | Where |
|---|---|---|
| Plan | hidden `agent` plan, $0.50 per weekly budget cycle, no resets | `lib/usage/plans.ts`, `lib/plans/plan-budget.ts` |
| All requests (pages, API, server actions) | 20/min, 200/hour, 1,000/day | `lib/rate-limit/catalog.ts` (`agent.all.*`) |
| Writes (any non-GET/HEAD/OPTIONS) | 6/min, 60/day | `agent.write.*` |
| Simultaneous LLM streams | 1 on the chat gate's pre-check | `lib/plans/plan-capacity.ts` |
| Voice | Speak Realtime session start and both TTS routes return 403 | `lib/agent-account/agent-account.ts` |
| Unfinished surfaces | sandbox, labs, prototypes, Stage, through its own `lab_access` row (setup step 4) | `lib/admin/lab-access.ts` |

The throttle runs in `proxy.ts` before any route, so it also protects Clerk, Supabase, Redis
and the services behind the app. If Upstash can't be reached, agent requests get a 503 rather
than going through unthrottled. An agent account is **not** an admin, even if it has an
`admin_access` row: `/admin`, `/status`, admin APIs and admin-only models stay closed.

When a limit is hit, API calls get `429` JSON with `code` `agent_rate_limit` (or
`plan_limit` for the weekly budget) and a `Retry-After` header. Wait that long; don't retry
in a loop. Refused requests still count against the limits.

## One-time setup (owner)

1. Create a Clerk user with an email and password, and no second factor. On a Clerk
   development instance, an address like `agent+clerk_test@example.com` signs in with the
   fixed test code instead of a real inbox.
2. Sign in once in a browser so the app creates its profile.
3. Put the user's Clerk id (`user_…`) in the checkout's `.env.local`:
   `AGENT_TEST_CLERK_USER_IDS=user_…`, then restart `bun dev`.
4. Grant labs with a `public.lab_access` row for the user's profile, as postgres. Apply
   `docs/migrations/lab_access.sql` once if the table doesn't exist yet; the grant block at its
   end adds the row from the Clerk id. Lab access is a database grant with the same controls as
   `admin_access`. It is not part of the agent list, and it doesn't make the account an admin.
5. Give agents `E2E_CLERK_EMAIL` and `E2E_CLERK_PASSWORD` through their local environment.
   Never commit them, and never put the Clerk id in source: this repository is public.

Unsetting the variable lifts every agent limit at once but leaves lab access; delete the
`lab_access` row to take that away. The account then goes back to whatever plan it would
otherwise have: its stored entitlement (`free` unless someone set another), or `max` if it is
on `MAX_PLAN_CLERK_USER_IDS`. Use a fresh Clerk user for agents,
never one with a paid plan, a max override or `admin_access`. Admin access is ignored while
the account is listed, but comes back when it isn't.

## Known limits

- Routes that reserve a stream slot in the database still allow 5 streams. Per-step budget
  checks and the write limit bound them.
- Clerk's own sign-in endpoints don't go through the app. Session reuse (below) keeps
  sign-ins rare.
- Next's image optimizer (`/_next/image`) bypasses the proxy. It only resizes the app's own
  images (no remote image hosts are configured), so it costs local CPU, not a paid service.
- The Stage demo's scene router checks the plan budget, but its small model call isn't
  recorded in the usage ledger.

## Signing in as an agent

Sign in **once**, save the session, and reuse it. Signing in on every run is what floods Clerk.

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 AGENT_SAVE_SESSION=1 \
  bunx playwright test tests/e2e/agent-session.spec.ts
```

That runs `tests/e2e/agent-session.spec.ts`, which signs in with `E2E_CLERK_EMAIL` /
`E2E_CLERK_PASSWORD`, checks that `/api/usage` reports the `agent` plan (so it never saves an
ordinary account's session), and writes `.private/agent-storage-state.json` (gitignored). Without
`AGENT_SAVE_SESSION=1` it is skipped, so normal e2e runs don't sign in an extra time.
`PLAYWRIGHT_BASE_URL` points at the server that is already running; without it Playwright
would start its own.

Later runs open a context with `storageState: ".private/agent-storage-state.json"` and skip
sign-in. Sign in again only when the saved session has expired.

Don't start a dev server yourself: ask the owner, who may already have one running.
