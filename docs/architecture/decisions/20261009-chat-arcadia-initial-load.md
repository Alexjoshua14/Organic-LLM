# Avoid redundant work when opening Chat and Arcadia

**Status:** Accepted\
**Date:** 2026-10-09\
**Affects:** Chat loading, Arcadia creation, Multiagent synchronization

## Context

Cold development navigation spends most of its time compiling routes. Additional
application work included an Arcadia creation redirect, a separate routing update,
repeated ownership reads and worker polling
in ordinary Arcadia chats. Compilation and application latency must be measured separately.

## Decision

- Reuse the existing Arcadia creation action in the sidebar and navigate directly to the
  canonical thread URL. Disable new-thread buttons while creation is pending. Direct
  visits to the index retain their creation/redirect behavior.
  Links to creation indexes disable prefetch so reading a gateway cannot create unused threads.
- Insert Arcadia routing and the authenticated owner with the thread in one database
  operation. The server derives the path; callers cannot supply ownership or routing paths.
- Load thread and messages concurrently through one authenticated Supabase RLS client.
  Decode messages only after a successful thread read, using that thread's owner as the
  encryption context. Preserve errors rather than returning partial conversations.
- Remove the unused extra message query from the main Chat page.
- Preserve Multiagent and parent linkage fields already returned by the thread query.
  Seed Arcadia with its saved view and an owner-filtered, limited worker-presence read.
  Subagent pages use their parent's view and workers. UI state never authorizes a request.
- Ordinary Arcadia chat starts no worker-board, message, or heartbeat requests when the
  server confirms there are no workers. Unknown presence retains discovery. Existing
  workers continue updating even with Multiagent off; live dispatch can request a board
  refresh before the next discovery poll.
- Use a 30-second discovery cadence for ordinary chat and 2.5 seconds when Multiagent is
  enabled or workers exist. Same-browser synchronization remains immediate. Focus and
  visibility restoration trigger a fresh read. Serialize polls, abort pending view/board
  reads on cleanup, and ignore late results. Hidden tabs skip network polling.
- Keep server ownership gates and RLS. The discovery endpoint authenticates and checks
  ownership before its parallel metadata reads, filters worker presence by owner and
  parent, returns no message content, and disables response caching. No cross-user cache
  or persistent decrypted-message cache is introduced.

## Validation

Provider tests cover Strict Mode ordinary-chat startup, existing workers with the dashboard
off, cross-device discovery, pending toggles, stale responses, hydration, and unmount aborts.
Board tests retain serialized refresh, unchanged-roster identity, and voice-context coverage.
Data tests cover atomic routing/ownership, unauthenticated creation denial, owner-filtered
worker presence, parallel reads, encrypted-message round trips, denied reads, and wrong-owner
decryption failure. Sidebar integration tests cover creation navigation, including repeated clicks.

Use the [performance journey workflow](../../perf-journeys.md) for warm-run comparisons.
A single development timing is diagnostic evidence, not a performance guarantee.
