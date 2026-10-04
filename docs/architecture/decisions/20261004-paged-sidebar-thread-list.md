# The sidebar thread list is paged, filtered on the server, and patched in place

**Status:** Accepted
**Date:** 2026-10-04
**Affects:** `app/api/chats/route.ts`, `data/supabase/sidebar-threads.ts`, `lib/chat/sidebar-threads.ts`, `lib/context/chat-context.tsx`, `components/sidebar/`

## Context

GET `/api/chats` returned every thread the user owned. That included rabbit-hole, Speak, Arcadia, subagent, and memory-ingest threads, which the client then filtered out. The route made four network hops in series (Clerk, Upstash, profile lookup, threads), and every row mounted its own dropdown menu. Every mutation refetched the full list. The sidebar took seconds to appear for heavy users.

## Decision

- Keyset paging on `(updated_at, id)`: 50 unpinned rows per page, with pinned threads returned whole on the first page. The cursor keeps the raw Postgres timestamp; a `Date` round trip drops microseconds and would skip or repeat rows.
- Feature filtering is server-side, keyed by scope (`main`, or `all` for coalescence mode).
- The rate limiter and owner lookup run in parallel. The Clerk-to-profile id is cached per instance for 5 minutes.
- `Server-Timing` on every response. Target: first page under 750ms.
- Client: `useSWRInfinite`. Revalidation refetches the first page only. Mutations with a known result patch the cache instead of refetching. See the contract in `docs/thread-session-architecture.md` §4.
- Row menus mount on first hover, focus, or open.

## Consequences

- Threads older than the loaded pages are not in `sidebarChats`. Consumers that look up a thread by id there (for example, the title overlay) fall back to their own data.
- A change to a thread in an older page from another device or tab shows after `refreshSidebarChats({ allPages: true })` or a reload, not on focus.
- When a thread moves to the top, deeper page cursors shift and those pages refetch. Only users who have scrolled pay for that.
- The index in `docs/migrations/threads_sidebar_list_index.sql` must exist in each environment for paging to stay a range scan.

## Open

- Persisting the first page in `localStorage` would show the sidebar instantly on reload. The cache contract does not allow persisting the thread list on the client, and titles may be sensitive on shared devices. Not adopted; tracked on COA-225.
