# Product notes — the Organic ecosystem

> Captured 2026-07-20 from founder direction. These are product notes, not a spec; they set the
> frame future features should be designed against.

## Roles

- **Organic LLM is the chat interface.** Its identity is organic, natural, smooth conversation —
  the place where thinking happens out loud. It is *not* the implementation surface and should not
  grow into one.
- **Implementation happens elsewhere.** Other systems (Cursor, agents, CI) or manual/human coding
  are the implementation interfaces. Organic LLM's job is to gather the full picture and hand
  well-formed context *to* them — see the Stratum chat style's handoff chunks
  ([stratum-chat.md](./stratum-chat.md)).
- **Dedicated apps are full-immersion experiences.** Each owns one job deeply, with its own UX,
  rather than being a mode inside the chat app:
  - **Stratum** — project-centered management. (The Arcadia "Stratum" chat style is the
    conversational on-ramp/precursor; the dedicated app is where a project *lives*.)
  - **Inferno**
  - **Chronos**
  - **Introspection** — already has an in-repo surface and a working encrypted handoff
    (`lib/organic-relay/`).
  - **Chronosphere**
  - (…and others as they emerge.)

## The subway — inter-app infrastructure

Eventually the apps interconnect through shared infrastructure: a "subway of information" moving
context between nodes (e.g. Organic LLM → Introspection, Organic LLM → Stratum).

Requirements, in priority order as stated:

1. **Highly secure, encrypted node-to-node.** Every hop is encrypted end-to-end between the two
   apps involved; intermediary infrastructure never sees plaintext.
2. **Optimized for speed and performance.** Handoffs should feel instantaneous — leaving one app
   and arriving in another with context intact is a core UX moment, not a background sync.
3. **Reliable.** Delivery semantics need to be explicit (TTL, replay protection, at-least-once vs
   exactly-once) so a handoff never silently vanishes.

### Existing groundwork

- `lib/organic-relay/` — versioned wire format (`WIRE_PREFIX`/`WIRE_VERSION`), AES-256-GCM payload
  encryption, TTL, schema-validated bootstrap payloads for the Organic LLM → Introspection handoff.
  This is the prototype line for the subway; generalizing it (app-agnostic envelope, per-route
  schemas, key management story) is the natural next step.
- Stratum chat style handoff chunks — self-contained context briefs designed to be pasted into an
  implementation interface today, and shipped over the subway tomorrow.
- Thread/session architecture + E2EE docs ([thread-session-architecture.md](./thread-session-architecture.md),
  [e2ee.md](./e2ee.md)) — constraints any transport must respect.

### Open questions (spike material)

- Transport shape: direct app-to-app handoff links (current relay model) vs a routed hub, and what
  "node" identity/authentication looks like (per-app keys? Clerk-scoped? key rotation?).
- Envelope generalization: one versioned envelope with per-route payload schemas vs per-route wire
  formats.
- Delivery semantics: TTL + one-shot consume (current) vs durable inbox per app.
- Where the subway lives: shared package in this repo, extracted library, or a small service.

## Design tenets to hold

- Conversation stays organic in Organic LLM; immersion stays dedicated in the apps; neither should
  absorb the other's job.
- Handoffs are the product seam: every dedicated app should be reachable from a conversation with
  its context intact, and able to return results the same way.
- Security is not a later layer — every new cross-app surface starts from the encrypted-hop model
  organic-relay already established.
