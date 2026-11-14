# Ergon linked documents

Durable markdown documents that the model writes in **Ergon chat style** and links to tickets on
the in-thread kanban board. This is separate from the [Ergon connection](./README.md) to the
external engineering tracker, whose `ergon_*` ticket tools run over MCP.

Decision record: [linked documents in Postgres with a living thread viewer](./decisions/20260901-linked-documents-postgres-living-message.md).

## Three layers in Ergon chat style

| Layer | Tool / store | Persistence |
|-------|--------------|-------------|
| **Durable todos** | `manage_tasks` | Supabase `tasks`, `task_categories` → `/ergon` page |
| **Kanban board** | `kanban_board` | Client localStorage per thread (`organic-llm.kanban.v1`) |
| **Linked documents** | `ergon_document` | Supabase `ergon_documents` (encrypted content, RLS) |

The kanban board is a puppet UI: the model drives it via `data-kanban` commands. Documents are
durable and encrypted. Ticket links reach the client board as `LINK_DOCUMENT` on the same
channel. `LINK_DOCUMENT` is client-only; it is not part of the `kanban_board` command union the
model sees.

## Living document viewer

When the model creates or opens a document, or the user clicks a doc chip on a ticket, the thread
gets an assistant message with an `ergon_document` tool part. While that message is **the latest**
in the thread, the document renders in an in-chat viewer. After the next message it collapses to
a chip; clicking the chip re-opens it as a new latest message
(`POST /api/ergon/documents/[id]/open`).

## Setup

Apply [`docs/migrations/ergon_documents.sql`](../migrations/ergon_documents.sql) before deploying.
It is not auto-applied. Without the table, the `ergon_document` tool returns an error result and
the rest of Ergon chat style keeps working.

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

Board state, including which tickets show doc chips, is localStorage-only. Documents are durable
in Postgres: on a new device the document history appears in the thread, but kanban cards may not
show chips until the model re-links them or the user opens a document from a thread chip.
