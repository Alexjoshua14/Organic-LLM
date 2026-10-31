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

## Ergon connection (operational)

Organic talks to the separate Ergon engineering tracker. **Per-user product path is MCP
OAuth** to Ergon’s MCP endpoint (default `https://ergon.coalescencelabs.app/mcp`), following
the same Chronos-style short-lived `@ai-sdk/mcp` client pattern used for Reed’s git tools.

## Per-user connection (MCP OAuth)

Each signed-in user connects their Ergon workspace in **Settings → Connectors**:

1. Click **Connect with Ergon (OAuth)**.
2. Organic starts AuthKit PKCE (`/api/profile/connectors/ergon/oauth/start`), redirects to
   Ergon’s authorization server, and completes the code exchange on
   `/api/profile/connectors/ergon/oauth/callback`.
3. Access (+ refresh) tokens are stored **server-side only** (encrypted when
   `ORGANIC_LLM_ROOT_SECRET` is set) and never returned to the browser.

While connected:

- **Mira** (`agent-planner`, `tools.ergon`) loads docs / briefs / hooks / agent-run tools over
  **MCP** (`createErgonAgentTools` → `callErgonTool` / `callErgonMcpTool`).
- **Main chat** loads write ticket tools (`createErgonTicketTools`) when the connection includes
  Organic `write` scope (same MCP OAuth session).
- Workbench shorthand: `connector:ergon` (status only — no credentials; routes to Mira).

There is **no second Ergon hard-set agent** — Mira owns `tools.ergon`. Disconnect clears stored
tokens; tools disappear until the user reconnects (or the admin env bridge applies).

Deployments need `ERGON_OAUTH_CLIENT_ID` and a redirect
(`ERGON_OAUTH_REDIRECT_URI` or `NEXT_PUBLIC_APP_URL` +
`/api/profile/connectors/ergon/oauth/callback`). Optional: `ERGON_OAUTH_CLIENT_SECRET`,
`ERGON_OAUTH_ISSUER`, `ERGON_MCP_URL`.

Paste-token connect is **not** the Settings product UX (`PUT` returns 405).

## Admin / owner REST fallback

`ERGON_URL`, `ERGON_TOKEN`, `ERGON_AGENT_TOKEN`, and `ERGON_OWNER_PROFILE_ID` remain available
as a **server-wide admin fallback** for one Supabase profile when no per-user OAuth session
exists (or lacks the required scope). That path uses REST `/api/rpc`. Ticket tools use
`ERGON_TOKEN`; Mira uses `ERGON_AGENT_TOKEN`. Per-user MCP OAuth takes precedence when present.

See [connected ticket tools](./decisions/20261016-connected-ticket-tools.md) and
[chat tools](../chat-tools.md).
