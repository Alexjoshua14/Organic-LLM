# Ergon connection (operational)

Organic talks to the separate Ergon engineering tracker. **Per-user product path is MCP
OAuth** to Ergon’s MCP endpoint (default `https://ergon.coalescencelabs.app/mcp`), following
the same Chronos-style short-lived `@ai-sdk/mcp` client pattern used for Reed’s git tools.

## Per-user connection (MCP OAuth)

Each signed-in user connects their Ergon workspace in **Settings → Connectors**:

1. Click **Connect with Ergon (OAuth)**.
2. Organic starts AuthKit PKCE (`/api/profile/connectors/ergon/oauth/start`), redirects to
   Ergon’s authorization server, and completes the code exchange on
   `/api/profile/connectors/ergon/oauth/callback`.
3. Access (+ refresh) tokens are stored **server-side only**, encrypted, in the
   `ergon_connections` table ([migration](../migrations/ergon_connections.sql)), and never
   returned to the browser. The save must succeed before Settings reports "connected".

While connected:

- **Mira** (`agent-planner`, `tools.ergon`) loads docs / briefs / hooks / agent-run tools over
  **MCP** (`createErgonAgentTools` → `callErgonTool` / `callErgonMcpTool`).
- **Main chat** loads write ticket tools (`createErgonTicketTools`) when the connection includes
  Organic `write` scope (same MCP OAuth session).
- Workbench shorthand: `connector:ergon` (status only — no credentials; routes to Mira).

There is **no second Ergon hard-set agent** — Mira owns `tools.ergon`. Disconnect clears stored
tokens; tools disappear until the user reconnects.

Deployments need `ERGON_OAUTH_CLIENT_ID` and a redirect
(`ERGON_OAUTH_REDIRECT_URI` or `NEXT_PUBLIC_APP_URL` +
`/api/profile/connectors/ergon/oauth/callback`). Optional: `ERGON_OAUTH_CLIENT_SECRET`,
`ERGON_OAUTH_ISSUER`, `ERGON_MCP_URL`.

Pasting a token is **not** supported (`PUT` returns 405).

## Storage and security

Ergon and Organic are separate applications. Organic holds only what each user delegated: that
user's own tokens and connection metadata. There is no shared or deployment-wide Ergon
credential.

- **Table:** `public.ergon_connections`, one row per profile. Row-level security is on with no
  policies and every privilege is revoked except for `service_role`; the browser never reads it.
  Apply [`docs/migrations/ergon_connections.sql`](../migrations/ergon_connections.sql) before
  deploying. It is not auto-applied.
- **Encryption:** tokens are AES-256-GCM ciphertext with a per-user key. In production
  (`NODE_ENV=production`, including previews) Organic refuses to store or read a token that is
  not encrypted, so `ORGANIC_LLM_ROOT_SECRET` is required.
- **Refresh:** a database lock plus a version compare-and-swap ensure one instance refreshes at
  a time and a stale writer never overwrites newer tokens.
- **Errors:** a store failure is never shown as "not connected". Settings returns 503, tools are
  unavailable for that turn, and logs carry only a short error code.

See [connected ticket tools](./decisions/20261016-connected-ticket-tools.md) and
[chat tools](../chat-tools.md).

Ergon chat style's in-thread kanban board and its durable linked documents are a separate,
Organic-only feature: see [Ergon linked documents](./linked-documents.md).
