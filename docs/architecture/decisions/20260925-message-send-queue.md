# ADR: Multi-mode message send queue

**Date:** 2026-09-25  
**Status:** Accepted (first slice)

## Context

In multitask / multi mode the main composer must stay free while an agent streams or the
user is at quota. Messages need to survive refresh and be dispatchable when readiness is
observed on the server (stream finished, budget recomputed), not only in the open tab.

## Decision

1. Persist a FIFO queue in Supabase (`message_send_queue`).
2. Client enqueues via `POST /api/chat/queue`; CoreInput `queueSendMode` switches submit off
   `sendMessage` onto that path.
3. Server dispatches when `threads.active_stream_id` is null **and** plan budget allows.
4. Dispatch reuses `runLLMChatStream` (no parallel LLM stack).
5. Plans: default `free` ($40/month from `llm_usage_events.cost_usd`); `max` via
   `MAX_PLAN_CLERK_USER_IDS` env allowlist only — no personal identifiers in source.
6. Max plan numeric ceiling left **unset** (open question).

## Consequences

- Arcadia multitask shell must pass `queueSendMode` when wiring the shared composer.
- Migration must be applied manually (`docs/migrations/message_send_queue.sql`).
- Queue does not yet store file attachments (open question).
