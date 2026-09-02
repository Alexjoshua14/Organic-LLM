# Ergon linked documents in Postgres with a living thread viewer

**Status:** Accepted  
**Date:** 2026-09-01  
**Affects:** `ergon_document` tool, `ergon_documents` table, Ergon chat style UI

## Context

Ergon chat style kanban tickets are client-side (`kanban_board` + localStorage). Users need
durable markdown documents the LLM can author and link to tickets, with an in-thread viewer
that stays expanded only while it is the latest message.

## Decision

1. **Store document bodies in Supabase Postgres** (`ergon_documents`), not object storage.
   Content is encrypted with the existing per-user message encryption helper and RLS-scoped
   to the owner.

2. **Link tickets on the client channel only** via `LINK_DOCUMENT` on `data-kanban` (not
   exposed to the LLM `kanban_board` command union). The tool executor emits this after
   create/update.

3. **Persist user-open actions** as real assistant `UIMessage` rows with a canonical
   `ergon_document` OPEN tool part (`POST /api/ergon/documents/[id]/open`).

4. **Active viewer rule:** render the full viewer when the tool message is the last message
   in the thread; otherwise show a collapsed chip. Re-open inserts a new living message.

## Consequences

- Documents survive reload and are visible in thread history.
- Kanban card chips may be missing on another device until re-linked (same cross-device gap
  as the board itself).
- No document version history table in v1; `version` increments on update in place.
