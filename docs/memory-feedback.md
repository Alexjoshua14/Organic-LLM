# Memory feedback operations

Implementation: `lib/memory/feedback.ts`, `feedback-service.ts`, `feedback-draft.ts`, and
`data/supabase/memory-feedback.ts`. Product intent lives in the private hub at
`organic-llm-hub/memory/product-spec.md`.

## Deployment

1. Review and run [`migrations/memory_quality_tables.sql`](./migrations/memory_quality_tables.sql)
   in the intended Supabase project. It is a transactional bootstrap migration: any existing
   quality table aborts the transaction so an incompatible schema is not silently adopted.
   Prerequisites are `public.profiles(id uuid)` and the existing Clerk-aware
   `public.current_profile_id()` function returning UUID. It creates no policy on messages or memories.
   Then run [`migrations/memory_feedback_shared_memory.sql`](./migrations/memory_feedback_shared_memory.sql)
   once to add optional memory sharing. If the bootstrap already succeeded, run only this follow-up.
   Existing rows receive null sharing fields; no original memories are copied automatically.
2. The application must have its existing `ORGANIC_LLM_ROOT_SECRET` and any historical
   encryption keys needed by `lib/crypto/message-encryption.ts`. Keep keys outside Supabase.
   Votes can save without this key; sharing a note or memory copy fails without it. Never substitute plaintext.
3. The developer view also needs the existing server-only `SUPABASE_SERVICE_ROLE_KEY`, and
   the signed-in profile must have `admin=true`. The role receives SELECT only on feedback.
4. Existing Qdrant records can be initialized with
   `bun run scripts/backfill-memory-reference-count.ts` (count-only), then
   `bun run scripts/backfill-memory-reference-count.ts --apply` after checking the target.
   Uses `MEMORY_API_HOST`, `MEMORY_API_SECRET` and the app's `memories_v2` collection.
   It sets only missing `reference_count` values to zero. New records initialize automatically.

The migrations and backfill are not automatically run by the application. Apply the Supabase schema before
exposing these controls; missing tables return a visible error rather than a false save.

## Data boundary

- A feedback row contains one current vote, an opaque memory ID, ownership, timestamps,
  revision, optional `note_ciphertext` / `note_approved_at`, and optional
  `memory_ciphertext` / `memory_shared_at` for an explicitly approved memory copy. No chat ID.
- Notes and memory copies use the existing AES-256-GCM service with user, memory ID, and distinct field names
  as authenticated context. Plaintext fallback is forbidden. Keys stay in the application;
  database-only access sees ciphertext. Authorized application access can decrypt shared content.
- The agent only drafts. Explicit user approval saves the displayed text. Editing is another
  explicit approval. Owner RLS, column grants, an atomic vote-change trigger, and revision
  predicates protect mutations. Changing a vote clears both the note and its approval time.
- The separate sharing button previews the full selected memory and discloses admin access.
  On approval the server re-reads the owner's memory and requires an exact match with the preview.
  It saves an encrypted copy, never a live link. Unavailable, changed, or overlong memories cannot
  be shared. Owners can remove the copy independently of their vote/note, including after deleting
  the original. Note edits and vote changes preserve the copy and its original sharing timestamp.
- Deleting a Mem0 memory does not delete feedback. Owners can manage retained rows in Settings
  without access to the original memory. Deleting the owning profile cascades to feedback.
- Drafts exist in component state and request memory only, with no-store responses and AI SDK
  content tracing disabled. The gateway is asked for zero data retention. Background context
  is bounded to the user's selected memory, up to five related memories, and up to twelve recent
  messages from an owned origin thread when its `chat_id` metadata is available. Older memories
  without that metadata have no linked chat context. The prompt minimizes private details in
  proposed notes; users must still review the exact text before sharing.
- Quality-event metadata accepts only approved numeric/boolean telemetry keys in both code
  and SQL. Automatic agent flags cannot save notes. Drafts, approved plaintext, chat context,
  and memory text are not sent to quality logs.
- The admin feedback view decrypts approved notes and explicitly shared copies and counts current votes. It never
  follows memory IDs into Qdrant or reads users' chats. Existing daily ingest/eval views remain
  scoped to the signed-in admin's own account. No automatic feedback analysis runs.

## Verification

`bash scripts/test-memory-feedback-db.sh` starts an isolated Supabase Postgres container,
applies both migrations against synthetic UUID profiles and a UUID-returning identity helper, exercises grants, RLS,
upsert/clearing, stale edits, and telemetry constraints, then removes the container. This does
not establish that a deployed project's identity helper or profile policies are configured
correctly; verify those prerequisites in the target project.

`bun run test:unit` includes approval/encryption, context ownership, dismissal, note editing,
and reference-count preservation tests. Run `bun run lint:check` and `bunx tsc --noEmit` as well.
