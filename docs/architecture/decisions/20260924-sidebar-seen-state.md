# Sidebar "new since last look" state is stored server-side

**Status:** Accepted — implemented 2026-09-25 (migration `docs/migrations/thread_attention_table.sql` must be applied)
**Date:** 2026-09-24
**Affects:** `thread_attention` table (new), `threads.active_stream_started_at`, `app/api/chats/activity`, `app/api/chats/[id]/seen`, `hooks/use-sidebar-activity.ts`, `components/sidebar/*`

## Context

The sidebar is gaining per-session status: which threads are working right now, and which
received new content since the user last looked. Nothing tracks the second today.

Two constraints shape where that state lives:

- **Parallel sessions.** The same user can have the app open on several devices or tabs at
  once. Seen state kept in one browser would mark a thread unread on every other device after
  the user already read it.
- **`updated_at` is not an activity signal.** It advances on every thread write, including the
  per-turn `active_stream_id` update (see `getLatestThreadByFeature` in
  `data/supabase/chat.ts`). Comparing it to a seen time would flag threads the user merely
  pinned, renamed, or started streaming in.

## Decision

Stated by the user, 2026-09-24:

1. **Seen state is a server column per thread**, so it syncs across devices and parallel
   sessions. It is not kept in `localStorage` or other per-browser storage.
2. **Speak threads are never marked new.** Voice sessions are realtime, so the user is present
   for everything they produce. This holds *for now* — revisit if Speak gains work that
   completes while the user is away.

## Consequences

- Seen state and a **content-activity timestamp** live in a side table, `thread_attention`
  (`last_activity_at`, `last_seen_at`, generated `unseen`), not on `threads`. Any write to
  `threads` advances `updated_at`, which orders the sidebar — marking a thread seen there would
  jump it to the top of the list.
- `last_activity_at` moves only when content lands: an assistant turn is saved
  (`lib/api/run-llm-chat-stream.ts`) or a rabbit-hole node completes
  (`lib/rabbit-holes/runGenerationAndPersist.ts`). Never for Speak.
- A thread is marked seen when it is on screen in a visible tab, not merely on route change. A
  reply that finishes while its tab is in the background is still new.
- Attention is a separate endpoint (`GET /api/chats/activity`, `POST /api/chats/[id]/seen`)
  rather than extra fields on `GET /api/chats`: it is polled while work runs, and the list is
  not. Seen changes from other devices arrive on focus revalidation. Contract:
  [thread-session architecture](../../thread-session-architecture.md#4-client-cache-contract).
- Speak rows skip the "new" treatment entirely; their live and paused states are separate
  signals.
