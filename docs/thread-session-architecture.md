# Thread and session architecture

This document describes the thread/session architecture across encrypted persistence and the client-side thread list (sidebar cache). It defines the contract between layers and the restore/failure behavior so the design stays explicit and prevents drift.

## 1. Layers

- **Encrypted persistence:** Supabase (`threads`, `messages`, `thread_summaries`) plus `lib/crypto/message-encryption.ts`. Message content, `thread_summaries.summary_text`, and `threads.conversation_summary` are encrypted at rest. Thread list metadata (`id`, `title`, `owner_id`, `created_at`, `updated_at`, `pinned`) is returned by `getChats()` without decryption; thread titles are not encrypted.
- **API / store:** `lib/chat/chat-store.ts` is the facade (createChat, loadChat, saveChat, getChats). GET `/api/chats` returns one page of the sidebar list via `getSidebarThreadsPage` (`data/supabase/sidebar-threads.ts`); see §4. Full thread load (thread + messages) goes through `loadChat` → Supabase + decrypt in `getMessages`/loadChat.
- **Client:** `ChatProvider` in `lib/context/chat-context.tsx` holds `chatId` and uses `useSWRInfinite` over `/api/chats` pages for the sidebar thread list. There is no persistent client cache (no localStorage/IndexedDB) for the thread list or message content.

## 2. Source of truth

- **Supabase** is the source of truth for threads and messages. The thread list from GET `/api/chats` is metadata-only (no message or summary content). Decryption happens only when loading a full thread (e.g. `getMessages` / `loadChat` on the server). The sidebar list is eventually consistent with the backend after `refreshSidebarChats()`.

## 3. Session semantics

- **Main chat:** “Session” = one thread. The slug in `/chat/[slug]` is the thread id. Navigation to a thread triggers a server-side load via `loadChat(id)` in the chat page RSC.
- **Remy** and **Rabbit Holes** have separate session models (tmp vs persisted, session storage, etc.); they are not covered in detail here.

## 4. Client cache contract

- **Paging:** GET `/api/chats?scope=main|all&cursor=&limit=` returns `{ data, pinned?, nextCursor }`, newest first, 50 unpinned rows per page (max 100). The cursor is the last row's raw `updated_at` and `id`; keyset paging on `(updated_at, id)` needs the index in `docs/migrations/threads_sidebar_list_index.sql`. The first page (no cursor) also carries every pinned thread. `scope=main` returns main chats; `scope=all` (coalescence mode) returns every feature except memory ingest. Filtering is server-side. The response sends `Server-Timing` (`auth`, `gate`, `db`, `total`); the first-page budget is 750ms.
- **Thread list:** `useSWRInfinite` holds loaded pages in memory, one cache per Clerk user and scope (key `[url, userId]`). No request runs until Clerk resolves a signed-in user; signing in starts the fetch at once, and a 401/403/429 is not retried on a timer. While the session or first page loads, the sidebar shows `SidebarChatsSkeleton`. `mergeSidebarPages` (`lib/chat/sidebar-threads.ts`) flattens them; a thread cached on two pages keeps the copy with the latest `updated_at`. Older pages load when the end of the list scrolls into view. There is no client-side persistence of the thread list.
- **Revalidation:** reconnect, and window focus at most once a minute. Both refetch the first page only, plus any page whose cursor moved.
- **After a mutation**, pick the narrowest call:
  - `updateSidebarChat(id, patch)` / `removeSidebarChat(id)` when the server confirmed the change and the client knows the result (rename, pin, generated title, delete). No refetch.
  - `refreshSidebarChats()` when the client cannot describe the change (create, new activity, server-side title). Refetches the first page, where new and bumped threads land.
  - `refreshSidebarChats({ allPages: true })` when any loaded thread may have changed (Settings → Chats).
- **Thread content:** No client-side persistence of decrypted message content. Thread content is always loaded server-side on navigation. Thread load is server-authoritative; there is no optimistic thread content on the client.

## 5. Client cache vs encrypted storage

- The thread list from GET `/api/chats` and from SWR **never** contains decrypted message or summary content. It contains only thread metadata (id, title, dates, pinned).
- Message and conversation-summary decryption happens **only** server-side in `getMessages` / `loadChat` (in `data/supabase/chat.ts`). If client-side persistence of decrypted content is added later, the policy and security implications must be documented.
- Thread titles are currently not encrypted; if they are encrypted in the future, the list API contract (e.g. decrypt in API or keep titles non-sensitive by policy) should be documented here.

## 6. Restore and failure behavior

- **Restore path:** User clicks a thread in the sidebar → `setChatId(threadId)` and `router.push(\`/chat/${threadId}\`)` → RSC runs `loadChat(id)` server-side. On success, the chat page renders with thread and messages; on failure, the page shows an error state (e.g. “This thread couldn’t be loaded”) with optional retry.
- **Active streams:** Chat and Arcadia always enable AI SDK stream resumption on mount and thread changes. Page snapshots can have stale or missing `active_stream_id`; they must not gate reconnection. The authenticated GET `/api/chat/[id]/stream` reads current thread state, attaches to an existing stream, or returns 204 when none exists. Navigation cleanup aborts the client connection; it does not stop the server's generation, so returning to the thread can reconnect.
- **Stream persistence:** `lib/chat/resumable-sse-stream.ts` connects and reuses the Redis publisher/subscriber before registering streams. Initial connection setup has a five-second deadline; failed setup closes both clients and permits a later retry, while consuming the original SSE stream without resumability. The resume route encodes replayed strings as UTF-8 bytes and returns `Cache-Control: no-store`, including 204 responses for inactive, expired, or finished streams.
- **Response identity:** The main Chat and Arcadia stream announces its stable assistant message ID before context or progress data. The merged model stream omits its own start event and persists that same ID. Replaying data before a message ID would create an extra temporary assistant message when reconnecting.
- **Invariants:** Thread load is server-authoritative. Sidebar list is eventually consistent after refresh. No optimistic thread content on the client.
- **Rate limit:** GET `/api/chats` is rate-limited (240 requests per hour per user, each page counts) to protect the thread-list endpoint; when exceeded, the API returns 429 with a clear message.
