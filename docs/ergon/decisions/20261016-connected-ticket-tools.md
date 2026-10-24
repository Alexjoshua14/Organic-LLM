# Connected ticket tools

## Transport decision (2026-10-22)

**Preferred default:** Ergon **MCP over OAuth** at `https://ergon.coalescencelabs.app/mcp`
(AuthKit issuer advertised by Ergon’s
`/.well-known/oauth-protected-resource`). Organic stores per-user OAuth access (and refresh)
tokens server-side and calls tools via `@ai-sdk/mcp`, matching Chronos
([`lib/llm/chronos-mcp-tools.ts`](../../../lib/llm/chronos-mcp-tools.ts)).

**Why not lock in REST Bearer `/api/rpc`?** MCP OAuth is already what Cursor and other clients
use against Ergon, supports refresh + consent, and keeps Organic on one protocol for Mira and
chat. REST remains only for the optional admin env bridge
(`ERGON_TOKEN` / `ERGON_AGENT_TOKEN` + `ERGON_OWNER_PROFILE_ID`).

Settings offers **OAuth connect/disconnect only** (no paste-PAT product UX). Deployments need
`ERGON_OAUTH_CLIENT_ID` + redirect; OAuth start returns 503 until configured. No secrets or
refresh tokens are ever returned to the client.

## Tool surface

The optional engineering-ticket connection exposes curated Organic tools
(`ergon_list_issues`, `ergon_get_issue`, `ergon_save_issue`, …). Organic’s chat model calls
Ergon directly through MCP (or REST admin fallback); there is no second model invocation through
intake. The current personal-todo tool and storage continue independently.

Each user may connect Ergon in Settings → Connectors via MCP OAuth. Credentials stay
server-side (never returned on GET). When present, main chat gets write ticket tools (Organic
`write` scope). Mira (`tools.ergon`) loads the user’s MCP session for docs / briefs / agent
runs (`agents` scope). There is no second hard-set Ergon agent.

An optional server credential (`ERGON_URL`, `ERGON_TOKEN`, `ERGON_OWNER_PROFILE_ID`) remains as
an admin fallback for a single Supabase profile. Missing configuration disables the tools.
Credentials remain server-only, redirects are rejected, and ambiguous writes are never retried
automatically. Mira skips the write ticket set on her turns.

`ergon_save_issue` exposes optional values plus a `clearFields` list. The adapter converts
only those named fields to REST/MCP `null` values; omitted fields stay unchanged, and setting
and clearing the same field is rejected before a request. This preserves patch semantics
without seven nullable unions in the model-facing schema. Anthropic limits union parameters
across the request's strict schemas, so schema size must be checked on the assembled toolset,
not just one tool ([provider limits](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)).
The offline regression exercises AI SDK serialization for Arcadia, Ergon and Remy with
ticket and orchestration tools. It does not reproduce Gateway's server-side transformations.

Live verification on 2026-10-18: one synthetic request containing 20 Arcadia/Ergon,
connected-ticket and orchestration tools succeeded through AI Gateway with
`anthropic/claude-opus-5-5` (canonical `anthropic/claude-opus-5.5`). Anthropic returned
HTTP 200 on the first provider attempt, with text `OK`, finish reason `stop`, and no tool
calls. Zero data retention was requested. The request contained static tool descriptions,
schemas and synthetic text; executors were removed. This confirms provider acceptance of
that assembled toolset, while the offline tests cover the other chat styles.

Setup and the tool catalog are in [chat tools](../../chat-tools.md). This connection does
not decide a future migration of Organic's personal task store.

## See also

- [Ergon connection README](../README.md) — per-user MCP OAuth + env REST fallback
