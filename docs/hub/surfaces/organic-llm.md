# Organic LLM (in-app) — surface adapter

**Role:** Where the user thinks out loud. The product is itself a hub surface.

**Canon:** [`docs/hub/README.md`](../README.md). This adapter links; it does not restate.

## Near-term

The user talks through product ideas inside Organic LLM — in chat, Speak, or a rabbit hole.
Those conversations are **raw intake**, not canon. An agent with repo access distils them to
the right layer per [maintenance-protocol.md](../maintenance-protocol.md).

Nothing in the app writes to the hub automatically. A thought becomes canon when an agent
records it in a file, which means: **a good conversation that never gets written down is lost.**

## Permissions

| Scope | Access |
|-------|--------|
| Repo, `.context/` | None — the app has no write path to canon today |
| Chat threads, memory | Owned by the app; not hub canon |

## Distilling a conversation

1. Sensitivity check first — most product conversation is strategic and belongs in
   `.context/hub/`, not `docs/`.
2. Split it: intent → `product-spec.md`; unresolved → `open-questions.md`; technical →
   an ADR; feel → the vision layer.
3. Record what was **decided** and what stayed **open**. Do not resolve an open question just
   because the conversation trailed off near an answer.

## Future

- Dev-docs mirror at `/dev/docs/product-hub` (Phase 5) — sources in `content/dev-docs/`,
  registry in `lib/dev-docs/registry.ts`. Public operational canon only.
- `docs/llms.txt` index so the in-app LLM can navigate the hub (Phase 6).
- Tools letting the app file Linear issues or Notion notes directly (Phase 7+).

None of these exist. Do not build them without an explicit request.
