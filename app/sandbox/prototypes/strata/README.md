# Strata README

This README explains what was built for the `Strata` prototype, how data flows through it, and where to extend it.

If you read this top to bottom, you should be comfortable reviewing the implementation and contributing directly.

## What Strata Is

Strata is a desktop-first prototype under `sandbox/prototypes` with 5 canonical sections:

1. `raw_text`
2. `refined_text`
3. `elaborated`
4. `design_instructions`
5. `ai_instructions`

Core UX goals implemented:

- Snap-scrolling between section cards.
- Sticky generate/update control when Raw/Refined is visible.
- AI create/update paths for Refined + Elaborated.
- Multi-page browser flow (`/sandbox/prototypes/strata` -> `/sandbox/prototypes/strata/[slug]`).
- Per-page local-only mode (ZDR) + fallback to encrypted local storage if DB is unavailable.

## High-Level Architecture

There are three major layers:

- **UI layer** (browser/list + detail shell)
- **Persistence layer** (Supabase + encrypted local storage)
- **AI generation layer** (route + tools + system prompts)

Primary routes:

- `app/sandbox/prototypes/strata/page.tsx`
- `app/sandbox/prototypes/strata/[slug]/page.tsx`
- `app/api/prototypes/strata/route.ts`

## File Map (What Each File Does)

### Prototype pages and UI

- `app/sandbox/prototypes/strata/page.tsx`
  - Strata browser/list page.
  - Tries loading pages from Supabase; if it fails, marks DB unavailable.
- `app/sandbox/prototypes/strata/[slug]/page.tsx`
  - Strata detail page.
  - Loads DB page when possible, otherwise boots with defaults and local fallback.
- `app/sandbox/prototypes/strata/_components/StrataBrowser.tsx`
  - List/create UI.
  - Uses server action create in DB mode, local creation in fallback mode.
- `app/sandbox/prototypes/strata/_components/StrataShell.tsx`
  - Main 5-section editor + generate flow + status badges.
  - Handles local-only toggle and persistence strategy selection.
- `app/sandbox/prototypes/strata/_components/SectionCard.tsx`
  - Shared section card container with snap behavior.

### Server actions and data

- `app/sandbox/prototypes/strata/actions.ts`
  - Server actions for DB writes and cache tag revalidation.
- `data/supabase/strata.ts`
  - Supabase CRUD + cached reads + section upsert semantics.
  - Contains "do not overwrite elaborated unless explicit" behavior.
- `docs/migrations/strata_pages_sections.sql`
  - DB schema for `strata_pages` + `strata_sections`, indexes, RLS, triggers.

### Local fallback and encryption

- `lib/strata/local-store.ts`
  - Encrypted local page CRUD.
  - Local page index, page payload storage, per-page ZDR mode flag.
- `lib/crypto/strata-local-encryption.ts`
  - Client-side AES-256-GCM encryption/decryption for local section content.
  - Uses HKDF-derived keys and contextual AAD-like binding (`pageId` + `sectionKey`).

### AI and prompts

- `app/api/prototypes/strata/route.ts`
  - Strata generation route.
  - Supports DB-backed generation (`pageId`) and local snapshot generation (`sectionsSnapshot`).
  - Runs tool-enabled context pass first, then structured object generation.
- `lib/system-prompt/strata-create.ts`
- `lib/system-prompt/strata-update.ts`
- `lib/system-prompt/strata-rubric.ts`
  - Prompt contracts and rubric guidance.

### Mem0 and knowledge graph tooling

- `lib/llm/strata-memory-tool.ts`
  - Mem0 search tool wrapper used by Strata generation route.
- `lib/llm/strata-knowledge-graph-tools.ts`
  - Tool definitions + stubs for:
    - `create_knowledge_node`
    - `update_knowledge_node`
    - `search_knowledge_nodes`
    - `traverse_knowledge_graph`
  - Large TODO blocks explain what to implement later.

### Schema and tests

- `lib/schemas/strata.ts`
  - Strata types + defaults + generation request/response schema.
- `tests/unit/strata-generated-sections.test.ts`
  - Tests generated section update semantics.
- `tests/integration/strata-route.test.ts`
  - Tests route auth/validation/not-found/success/snapshot behaviors.

## Runtime Flows

## 1) Browser/list flow

1. User opens `/sandbox/prototypes/strata`.
2. Server tries `listStrataPagesCached(ownerId)`.
3. If successful: DB mode.
4. If failed (e.g., tables not migrated yet): local fallback mode.

## 2) Detail page load flow

1. User opens `/sandbox/prototypes/strata/[slug]`.
2. Server attempts DB read for page.
3. UI shell mounts and loads local encrypted snapshot if it exists.
4. If no local snapshot exists, initial payload is persisted locally immediately.

Result: user can continue regardless of DB state.

## 3) Save section flow

`StrataShell.saveSection(...)`:

- Always saves encrypted local copy.
- Saves to Supabase only when:
  - DB is available, and
  - page is not in local-only mode.

## 4) Generate/create/update flow

`StrataShell.runGenerate(...)`:

- Calls `/api/prototypes/strata` with:
  - `pageId` in sync mode, or
  - `sectionsSnapshot` in local-only/fallback mode.
- Route performs:
  1. tool-enabled context pass (Mem0 + knowledge graph tools),
  2. structured `generateObject(...)` for final output.
- UI then:
  - updates local state,
  - persists encrypted local copy,
  - optionally persists to Supabase (if sync mode).

## Storage Modes (What User Sees)

There are three practical states:

1. **Sync mode** (default when DB is available)
   - Supabase + encrypted local backup.
2. **Local-only mode (ZDR)** (user toggled for current page)
   - Encrypted local only, no Supabase writes for that page.
3. **DB unavailable fallback**
   - Forced local-only encrypted mode, with warning badge.

UI badges in `StrataShell` explicitly indicate these states.

## Encryption Notes

For local-device persistence, section content is encrypted client-side before `localStorage` write:

- Algorithm: **AES-256-GCM**
- Key derivation: **HKDF-SHA256**
- Context binding: includes `pageId` + `sectionKey`

This is implemented in `lib/crypto/strata-local-encryption.ts`.

Important implementation detail:

- Existing `lib/crypto/message-encryption.ts` is server-only (`server-only`) and used for DB/chat contexts.
- Strata local persistence needed browser-safe encryption, so a dedicated client-side crypto module was added.
- The client module mirrors the architecture style of existing encryption flows (HKDF + contextual binding), but uses Web Crypto APIs.

## Knowledge Graph Stubs (What Is Real vs Placeholder)

In `lib/llm/strata-knowledge-graph-tools.ts`:

- Tool interfaces are real and wired into generation.
- Implementations are currently stubs that return placeholder payloads.
- Each stub includes a large TODO block with explicit guidance for future implementation.

Planned real implementation areas:

- durable node persistence
- semantic + metadata search
- pagination mechanics
- BFS/DFS traversal with layer/fanout controls
- edge and revision management

## How To Review This Safely

Recommended review order:

1. `lib/schemas/strata.ts`
2. `app/sandbox/prototypes/strata/_components/StrataShell.tsx`
3. `app/api/prototypes/strata/route.ts`
4. `lib/strata/local-store.ts`
5. `lib/crypto/strata-local-encryption.ts`
6. `data/supabase/strata.ts`
7. prompt + tools files
8. tests

This order gives schema -> UX -> API -> persistence -> tooling.

## How To Extend Next

If you want to contribute manually, these are the highest-impact next steps:

1. Implement real knowledge graph backend behind current stubs.
2. Add migration + generated Supabase types for Strata tables.
3. Add local-to-DB reconciliation for pages created during DB outage.
4. Add key rotation/versioning strategy for local encrypted payloads.
5. Add observability for tool calls (debug trace in Strata UI).

## Useful Commands

Run targeted Strata tests:

```bash
bun test tests/integration/strata-route.test.ts tests/unit/strata-generated-sections.test.ts
```

When you migrate DB:

1. Apply `docs/migrations/strata_pages_sections.sql`
2. Regenerate Supabase types (project convention)

## Current Known Limitations

- Local-only toggle currently controls write behavior; no full bidirectional conflict merge yet.
- Knowledge graph tools are stubs by design.
- Local encrypted storage uses browser `localStorage`; robust backup/export UX is not yet added.

