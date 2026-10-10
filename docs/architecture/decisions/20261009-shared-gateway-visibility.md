# Share gateway visibility without caching authorization

**Status:** Accepted\
**Date:** 2026-10-09\
**Affects:** Homepage gateways, `useIsAdmin`, admin authorization, development logging

## Context

Three homepage links independently requested the same profile flag. Their resolved-value
cache did not deduplicate pending requests, so concurrent mounts and development Strict Mode
produced repeated Server Action calls.

## Decision

- Use the existing SWR dependency through `useGatewayVisibility`. Sandbox, Status, and
  `useIsAdmin` share one pending request and result for the current user and Clerk session.
- Deduplicate for 60 seconds. Revalidate on focus, reconnect, stale remount, or explicit
  `refresh`; do not poll. Retry failures twice with a five-second base interval.
- Hide entries until an explicit grant arrives, and hide cached grants after lookup errors.
  Disable the query during authentication loading and sign-out. Do not carry previous data
  between cache keys or persist visibility in browser storage.
- The Server Action authenticates independently and validates the expected cache identity
  against that server session before reading the profile. The supplied identity never chooses
  which profile to read.
- Store grants in `public.admin_access`, separately from user-editable profile fields.
  A membership row grants admin access; deleting it revokes access. Only privileged database
  roles can write memberships. Authenticated users can read only their own row through RLS.
  The [migration](../../migrations/admin_access.sql) starts empty; initial grants are explicit.
- Query membership with an inner join to the authenticated user's profile. Server
  authorization remains fresh per request; missing membership and lookup failures deny access.
  The client cache cannot authorize protected operations. An unapplied membership migration
  denies access without raising a retryable error.
- Keep `/blog` and its homepage link public, including while signed out or authentication
  is loading. The Blog link does not request gateway visibility.
- Disable Next development Server Function argument logging, which can expose identifiers
  and private content. Keep incoming request timings. Remove explicit user/session identifiers
  from application diagnostics.

## Validation

`gateway-visibility.test.tsx` covers concurrent Strict Mode consumers, remount deduplication,
auth loading, sign-out, account/session switches, late responses, error recovery, and revocation
refresh. `admin-access.test.ts` covers identity forgery, malformed input, minimal profile reads,
fail-closed authorization, immediate server-side revocation, and denial before health checks.
The opt-in `admin-access-migration.test.ts` executes the migration in an isolated PostgreSQL
schema and rolls the transaction back. It verifies self-only reads, denied client writes and
upserts, anonymous denial, privileged grants/revocations, and profile-deletion cleanup. Set
`ADMIN_ACCESS_TEST_DATABASE_URL` explicitly and run through `bun run test:integration`.

The 60-second window governs UI revalidation only; it is not an authorization lifetime.
