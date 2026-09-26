/**
 * Multi-mode message send queue — public integration notes.
 *
 * Product intent (private hub may expand): in multitask / multi mode the main
 * composer stays free; messages are queued in Supabase and the server dispatches
 * when the target thread is idle and the user's plan budget allows.
 */

## Client

- Prop on `CoreInput`: `queueSendMode={true}` (requires `chatId`).
- Optional: `queueTargetAgentId` for multitask subagent targeting.
- Hook: `hooks/use-message-send-queue.ts` — enqueue + poll open items.
- Strip UI: `components/chat/message-send-queue-strip.tsx`.

### Arcadia multitask shell integration

The Arcadia multitask **orchestrator** window uses live `sendMessage` → `/api/chat` so the
user bubble and assistant stream appear in-thread (same as idle Arcadia chat). Pass
`multitaskSendTarget` on the chat request body for routing; do **not** enable
`queueSendMode` on that composer if visible streaming is required.

When a shell intentionally wants enqueue-only (composer stays free; no live SSE), pass:

```tsx
<CoreInput
  chatId={threadId}
  queueSendMode
  queueTargetAgentId={selectedAgentId ?? undefined}
  // ...existing props
/>
```

Do not call `sendMessage` directly while `queueSendMode` is on — CoreInput POSTs to
`/api/chat/queue` instead. That path persists and dispatches server-side but does not
paint the turn into the open chat UI.

## Server

| Piece | Path |
|-------|------|
| Enqueue + list | `POST/GET /api/chat/queue` |
| Dispatch | `lib/message-queue/dispatch.ts` |
| Gates (pure) | `lib/message-queue/dispatch-gates.ts` |
| Turn runner | `lib/message-queue/run-queued-chat-turn.ts` (reuses `runLLMChatStream`) |
| Plan tags | `lib/plans/plan-tags.ts` |
| Monthly budget | `lib/plans/monthly-budget.ts` |
| Migration | `docs/migrations/message_send_queue.sql` |

Dispatch runs: after enqueue, via `after()` on the queue route, and when a live chat
stream finishes (`runLLMChatStream` onFinish → `kickDispatchAfterStream`).

## Plans

- Default: `free` — **$40 / UTC calendar month** from sum of `llm_usage_events.cost_usd`
  (same estimator as the usage overlay: `lib/rate-limit/llm-cost`).
- `max`: Clerk user ids in env `MAX_PLAN_CLERK_USER_IDS` (comma-separated). Not subject to
  the $40 cap. **Numeric max ceiling is unset.**

## Apply migration

Not auto-applied. Run `docs/migrations/message_send_queue.sql` in the Supabase SQL editor
(or your usual migration path) before enabling multi-mode queue in production.
