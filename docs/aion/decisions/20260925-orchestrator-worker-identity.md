# Orchestrator / worker roles and identity marks

**Status:** Accepted — first runtime slice
**Date:** 2026-09-25
**Affects:** `lib/llm/subagents/**`, `lib/schemas/subagent-runtime.ts`,
`lib/schemas/thought-routing.ts`, `lib/schemas/arcadia-multitask-send-target.ts`,
`app/api/chat/route.ts`, `lib/message-queue/run-queued-chat-turn.ts`,
`components/agents/subagent-identity-mark.tsx`

## Context

The user-facing agent should stay free for input by acknowledging and delegating. Longer
work belongs to workers. Arcadia's multitask dashboard already sends
`multitaskSendTarget` (`orchestrator` | `subagent` + id); the chat route previously ignored it.

## Decision

1. **Runtime roles** `orchestrator` | `worker` in code (`lib/llm/subagents/roles.ts`), distinct
   from Arcadia display roles (`researcher`, `coder`, …).
2. **Return budget** `ORCHESTRATOR_RETURN_TARGET_MS = 7000` — product target for the
   orchestrator becoming available again after delegate/ack. Not a hard kill of worker jobs.
3. **Awareness bus** records worker progress, milestones, and completion for orchestrator
   state (separate from Speak-shell “milestones only spoken” policy).
4. **Multi-thought routing** on orchestrator-targeted (or omitted) sends: split thoughts,
   answer direct ones inline, assign each routed thought to an existing worker or a new one.
5. **Subagent-targeted sends** deliver the whole message to that worker — no re-split.
6. **Identity images** are abstract non-human marks, generated via existing `@ai-sdk/openai`
   image models, stored under `.data/subagent-identity/` behind a blob/meta interface (S3 later).
7. **Router ZDR** is mandatory (`ORCHESTRATOR_ROUTER_ZDR_PROVIDER_OPTIONS` /
   `jevRouterCallConfig`). Catalog model **Typesafe AI Jev** (`typesafe-ai/jev`,
   `requiresZeroDataRetention: true`). Heuristic is labeled fallback only when Jev throws.

## Open

- Whether the live Arcadia roster should travel on the chat request instead of the demo roster.
- When identity generation runs in production create paths (sandbox cards already have the URL slot).

## See also

- [Aion presence ADR](./20260921-presence-layer.md)
- [Arcadia multitask Speak](../../speak/decisions/20260925-multitask-subagent-speak.md)
