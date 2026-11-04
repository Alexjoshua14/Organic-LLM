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
- **Routes and server code** that already have a resolved user id (e.g. chat route, Aion handler, chat-store, llm-tool-kit) use the “for user” operations: `searchMemoriesForUser`, `getMemoriesForUser`, `addLatestMessagesToMemoryForUser`. These still apply rate limits and validation; callers must not pass client-supplied `userId`.
- **Trusted server routes** that already resolved the Supabase user id and need a full list snapshot without the memory *list* rate limit (e.g. lens overview ownership checks): `getMemoriesOwnershipSnapshotForUser` — callers must apply their own limits and auth.

### Store (`store.ts`)

- **Role:** Low-level, server-only. Talks to Mem0 client; no auth, no rate limits.
- **Identity:** Expects Mem0 user id (Supabase user id in this app). Callers must pass a server-resolved id.
- **Who may call:** Only `operations.ts` and tests that mock the store. No direct imports from `app/` or `components/` — use operations instead to avoid boundary leakage.

### Quality events (`quality-events.ts`, `feedback.ts`, `daily-rollups.ts`)

- **Role:** Content-free ingest telemetry, plus explicit user votes, optional approved notes, and optional explicitly shared memory copies.
- **`recordMemoryEvent`:** Structured `console.info` JSON plus optional Supabase insert into `memory_quality_events`.
- **`feedback.ts` / `feedback-service.ts`:** One current up/down vote per user and Mem0 ID. Server actions authenticate and validate ownership. Only an explicit approval action writes a note, encrypted before storage; draft conversations are never persisted. Automatic Delphi flags do not write feedback.
- **`computeDailyRollupsForUser`:** Aggregates events into `memory_quality_daily` (delete rate, size percentiles, feedback ratios).
- **Admin dashboard:** [`app/admin/memory-quality`](/app/admin/memory-quality). Access requires an explicit `admin=true` profile. Cross-user access returns current vote totals, approved notes, and explicitly shared memory copies, without retrieving live memory or chat content. Voluntary vote counts do not estimate overall memory accuracy.
- **User controls:** Memory card popover and Settings → Memory → Your memory feedback. Changing a vote clears its note. Memory deletion retains feedback; note edits/removal and separate feedback deletion remain available in Settings. Mutations use row ID and revision to reject stale changes.

See [deployment and encryption notes](../../docs/memory-feedback.md) for both SQL migrations.

### Reserved reference count

Memories live in Qdrant (`memories_v2`), not a Supabase `memories` table. The vector store wrapper initializes the numeric `reference_count` payload field to zero on insert, preserves it on text updates, and treats missing legacy values as zero on reads. Mem0 exposes it as `metadata.reference_count`. No retrieval path increments it yet. The deployment notes describe the optional backfill for existing records.

### Summary

| Layer     | Auth        | Rate limits | Callers                          |
|----------|-------------|-------------|-----------------------------------|
| Operations | Clerk + Supabase for “current user”; pre-resolved id for “for user” | Yes (all ops) | UI, server actions, routes, handlers, chat-store, llm-tool-kit |
| Store    | None        | No          | Operations only (and tests)       |

## Memory Lens regression tests

Run `bun run test:unit` and `bun run test:integration`; both run in the existing Test workflow.

| Coverage | Tests |
|----------|-------|
| Query/result validation, current-user scoping, bounded limits, ownership checks, denied searches/deletes | `tests/unit/memory-operations.test.ts` |
| Relevance, recency, missing/invalid metadata, stable ties, no mutation | `tests/unit/memory-sort.test.ts` |
| Actual lens/cards: 350 ms debounce, fresh results, stale response rejection, refresh, errors, pagination, delete/retry, voting | `tests/fixtures/memory-lens.test.tsx` |
| Real server actions and limiter wiring: per-profile buckets, exhausted limits, limiter failure, signed-out requests | `tests/fixtures/memory-rate-limits.test.ts` |
| Explicit approval, encryption, removal, stale/foreign edits, exact memory previews | `tests/unit/memory-feedback*.test.ts*` |

`tests/integration/memory-lens.test.ts` runs the two fixtures in separate Bun processes to avoid
global module mocks leaking between suites. They use real application components and logic with
mocked Clerk, vector storage, Supabase, and Upstash boundaries; no live credentials or LLM calls.
They verify rate-limit configuration and enforcement of denial, not Upstash's internal algorithm.

The workflow also runs `bash scripts/test-memory-feedback-db.sh` in a separate Docker job:
both migrations, actual Postgres grants/RLS, one current vote, note clearing on vote changes,
encrypted sharing fields, stale-write rejection, and removal. See the
[feedback deployment notes](../../docs/memory-feedback.md) for prerequisites and local usage.
