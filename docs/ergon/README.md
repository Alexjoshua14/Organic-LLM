# Ergon — planning and kanban

Ergon is Organic LLM’s planning surface: durable todos on `/ergon`, a client-side kanban
board in Ergon chat style, and linked markdown documents tied to board tickets.

| Doc | Holds |
|-----|-------|
| This README | What Ergon is, code paths, board vs todos vs documents |
| [`docs/ergon-spec.md`](../ergon-spec.md) | Approved MVP spec for durable todos |
| [`decisions/`](./decisions/) | ADRs (linked documents, …) |

Product intent (scope, acceptance criteria) lives in `organic-llm-hub/ergon/` when present.

## Three layers

| Layer | Tool / store | Persistence |
|-------|--------------|-------------|
| **Durable todos** | `manage_tasks` | Supabase `tasks`, `task_categories` → `/ergon` page |
| **Kanban board** | `kanban_board` | Client localStorage per thread (`organic-llm.kanban.v1`) |
| **Linked documents** | `ergon_document` | Supabase `ergon_documents` (encrypted content, RLS) |

The kanban board is a puppet UI: the model drives it via `data-kanban` commands. Documents
are durable and encrypted; ticket links are written to the client board via `LINK_DOCUMENT`
on the same channel.

## Living document viewer

When the model creates/opens a document, or the user clicks a doc chip on a ticket, the
thread gets an assistant message with an `ergon_document` tool part. While that message is
**the latest** in the thread, the doc renders in an in-chat viewer. After the next message,
it collapses to a completed tool chip (click to re-open).

## Code map

```
lib/schemas/ergon-documents.ts       — document + tool schemas
lib/schemas/kanban/link-document.ts  — LINK_DOCUMENT channel command
data/supabase/ergon-documents.ts     — encrypted CRUD
lib/llm/ergon-document-tool.ts       — LLM tool
lib/llm/ergon-document-execute.ts    — executor (testable)
lib/ergon-documents/open-message.ts  — synthetic OPEN message shape
lib/kanban/store.ts                  — board reducer (+ documents on items)
components/chat/ergon-documents/     — viewer, chip, open provider
components/chat/kanban/              — board UI (+ doc chips on cards)
app/api/ergon/documents/[id]/        — GET doc, POST open (persist message)
docs/migrations/ergon_documents.sql
```

## Known limitation

Board state (including which tickets show doc chips) is localStorage-only. Documents are
durable in Postgres; on a new device, doc history appears in the thread, but kanban cards
may not show chips until the model re-links or the user opens docs from thread chips.
