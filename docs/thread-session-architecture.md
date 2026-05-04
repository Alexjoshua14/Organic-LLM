# Thread and session architecture

This document describes the thread/session architecture across encrypted persistence and the client-side thread list (sidebar cache). It defines the contract between layers and the restore/failure behavior so the design stays explicit and prevents drift.

## 1. Layers

- **Encrypted persistence:** Supabase (`threads`, `messages`, `thread_summaries`) plus `lib/crypto/message-encryption.ts`. Message content, `thread_summaries.summary_text`, and `threads.conversation_summary` are encrypted at rest. Thread list metadata (`id`, `title`, `owner_id`, `created_at`, `updated_at`, `pinned`) is returned by `getChats()` without decryption; thread titles are not encrypted.
- **API / store:** `lib/chat/chat-store.ts` is the facade (createChat, loadChat, saveChat, getChats). GET `/api/chats` returns the thread list via `getChats(ownerId)`. Full thread load (thread + messages) goes through `loadChat` → Supabase + decrypt in `getMessages`/loadChat.
- **Client:** `ChatProvider` in `lib/context/chat-context.tsx` holds `chatId` and uses SWR with key `"/api/chats"` for the sidebar thread list. There is no persistent client cache (no localStorage/IndexedDB) for the thread list or message content.

## 2. Source of truth

- **Supabase** is the source of truth for threads and messages. The thread list from GET `/api/chats` is metadata-only (no message or summary content). Decryption happens only when loading a full thread (e.g. `getMessages` / `loadChat` on the server). The sidebar list is eventually consistent with the backend after `refreshSidebarChats()`.

## 3. Session semantics

- **Main chat:** “Session” = one thread. The slug in `/chat/[slug]` is the thread id. Navigation to a thread triggers a server-side load via `loadChat(id)` in the chat page RSC.
- **Remy** and **Rabbit Holes** have separate session models (tmp vs persisted, session storage, etc.); they are not covered in detail here.

## 4. Client cache contract

- **Thread list:** SWR holds the thread list in memory. Revalidation runs on reconnect (`revalidateOnReconnect: true`) and after mutations. There is no client-side persistence of the thread list.
- **When to refresh sidebar:** After create (SidebarNewChat, app/chat page redirect), delete (sidebar-delete-thread-button), and pin/title updates (sidebar-chat-list). `refreshSidebarChats()` is the single way to invalidate the list.
- **Thread content:** No client-side persistence of decrypted message content. Thread content is always loaded server-side on navigation. Thread load is server-authoritative; there is no optimistic thread content on the client.

## 5. Client cache vs encrypted storage

- The thread list from GET `/api/chats` and from SWR **never** contains decrypted message or summary content. It contains only thread metadata (id, title, dates, pinned).
- Message and conversation-summary decryption happens **only** server-side in `getMessages` / `loadChat` (in `data/supabase/chat.ts`). If client-side persistence of decrypted content is added later, the policy and security implications must be documented.
- Thread titles are currently not encrypted; if they are encrypted in the future, the list API contract (e.g. decrypt in API or keep titles non-sensitive by policy) should be documented here.

## 6. Restore and failure behavior

- **Restore path:** User clicks a thread in the sidebar → `setChatId(threadId)` and `router.push(\`/chat/${threadId}\`)` → RSC runs `loadChat(id)` server-side. On success, the chat page renders with thread and messages; on failure, the page shows an error state (e.g. “This thread couldn’t be loaded”) with optional retry.
- **Invariants:** Thread load is server-authoritative. Sidebar list is eventually consistent after refresh. No optimistic thread content on the client.
- **Rate limit:** GET `/api/chats` is rate-limited (e.g. 240 requests per hour per user) to protect the thread-list endpoint; when exceeded, the API returns 429 with a clear message.
