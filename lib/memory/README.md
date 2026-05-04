# Memory layer

This directory implements the app’s memory (Mem0) integration with a clear boundary between public API and low-level storage.

## Contract

### Operations (`operations.ts`)

- **Role:** The only public server API for memory. All memory reads and writes that go through the app boundary use operations.
- **Identity:** Resolved server-side only. The client never sends `userId` or any identity (except `memoryId` for delete, which is validated against ownership via Clerk + Supabase).
- **Rate limits:** All memory operations are rate-limited here (search, list, delete, wipe, add). See `lib/rate-limit/memory.ts`.
- **Schema:** Results from the store are validated with `lib/schemas/memory` at the boundary; invalid shapes return a generic error instead of leaking raw data.

**Who calls operations:**

- **UI / server actions:** Use “current user” operations only: `searchMemoriesServer`, `getCurrentUserMemories`, `getCurrentUserMemoriesBySearch`, `deleteMemoryForCurrentUser`, `wipeMemoryForCurrentUser`.
- **Routes and server code** that already have a resolved user id (e.g. chat route, Aion handler, chat-store, llm-tool-kit) use the “for user” operations: `searchMemoriesForUser`, `addLatestMessagesToMemoryForUser`. These still apply rate limits and validation; callers must not pass client-supplied `userId`.
- **Trusted server routes** that already resolved the Supabase user id and need a full list snapshot without the memory *list* rate limit (e.g. lens overview ownership checks): `getMemoriesOwnershipSnapshotForUser` — callers must apply their own limits and auth.

### Store (`store.ts`)

- **Role:** Low-level, server-only. Talks to Mem0 client; no auth, no rate limits.
- **Identity:** Expects Mem0 user id (Supabase user id in this app). Callers must pass a server-resolved id.
- **Who may call:** Only `operations.ts` and tests that mock the store. No direct imports from `app/` or `components/` — use operations instead to avoid boundary leakage.

### Summary

| Layer     | Auth        | Rate limits | Callers                          |
|----------|-------------|-------------|-----------------------------------|
| Operations | Clerk + Supabase for “current user”; pre-resolved id for “for user” | Yes (all ops) | UI, server actions, routes, handlers, chat-store, llm-tool-kit |
| Store    | None        | No          | Operations only (and tests)       |
