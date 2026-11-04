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
