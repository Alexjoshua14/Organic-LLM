# Invites

Organic LLM can run invite-only: an admin invites someone by email, they sign up through the
invitation link, and their account starts on the free plan with only finished surfaces visible.

## Sending an invite

Open **Admin → Invites** (`/admin/invites`). Enter an email address, and optionally a first
name and a personal note. The invitation expires after 30 days; pending ones can be revoked.

- **Branded email.** With `RESEND_API_KEY` and `INVITE_EMAIL_FROM` set, Organic creates the
  Clerk invitation without Clerk's email and sends its own through Resend, with a short tour
  of what to try. `INVITE_EMAIL_REPLY_TO` is optional. The sender must be on a domain verified
  in Resend; Resend's shared test sender only delivers to the account owner.
- **Fallback.** Without both values, Clerk sends its standard invitation email.
- **Failures.** If the invitation is created but the email fails, the page shows the
  invitation link so it can be shared directly. Each invitation is emailed at most once
  (Resend idempotency key).

Code: [`lib/api/admin-invites-handler.ts`](../lib/api/admin-invites-handler.ts),
[`lib/invites/invite-email.ts`](../lib/invites/invite-email.ts).

## Restricting sign-up to invitations

Sign-up mode is a Clerk instance setting. In the Clerk dashboard, set **Restrictions → Sign-up
mode** to **Restricted** for production. Invitation links still work; anyone else who opens
Sign up sees Clerk's restricted-sign-up message. Existing accounts are unaffected.

## What invited accounts see

New accounts read as the **free** plan (no entitlement row), with its weekly spend cap
([plans](../lib/usage/plans.ts), [usage ledger](./architecture/decisions/20261010-usage-ledger-and-entitlements.md)).

Finished surfaces: Chat, Arcadia (`/sandbox/arcadia`), Rabbit Holes, Ergon, Remy and Speak,
plus settings, plans, release notes and the public pages.

Everything else is admin-only and returns 404 for other accounts: the sandbox gateway and its
labs and prototypes (including Strata and Noesis), Stage, Archetype, Introspection and
Status. Each of those route trees re-exports
[`lib/admin/admin-only-layout.tsx`](../lib/admin/admin-only-layout.tsx) as its layout, which
runs on the server whenever navigation enters the subtree. Strata's entry points (rail,
homepage action, launcher, Cmd/Ctrl+Enter capture) are hidden for non-admins.

A new directory under `app/sandbox/` must add that layout, or be listed as finished in
`tests/unit/admin-only-surfaces.test.ts`; the test fails otherwise.
