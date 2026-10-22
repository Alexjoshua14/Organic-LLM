# Connected ticket tools

The optional engineering-ticket connection uses Ergon's existing REST tool registry.
Organic's chat model calls it directly; there is no second model invocation through intake.
The current personal-todo tool and storage continue independently.

A server credential grants access to one workspace, so registration and execution both
require the authenticated Supabase profile to match `ERGON_OWNER_PROFILE_ID`. Missing or
invalid configuration disables the tools. Credentials remain server-only, redirects are
rejected, and ambiguous writes are never retried automatically.

`ergon_save_issue` exposes optional values plus a `clearFields` list. The adapter converts
only those named fields to REST `null` values; omitted fields stay unchanged, and setting
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
