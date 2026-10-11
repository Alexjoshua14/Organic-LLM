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
| Weekly budget | `lib/plans/plan-budget.ts` |
| Migration | `docs/migrations/message_send_queue.sql` |

Dispatch runs: after enqueue, via `after()` on the queue route, and when a live chat
stream finishes (`runLLMChatStream` onFinish → `kickDispatchAfterStream`).

## Plans

- The server reads the owner's plan from `account_entitlements` and checks net spend in the
  current weekly window. Exhausted allowances hold queued messages; unreadable authorization
  or accounting data also holds dispatch. A reset opens a fresh window without deleting history.
- The privileged `MAX_PLAN_CLERK_USER_IDS` override remains available. See
  [usage ledger and entitlements](./architecture/decisions/20261010-usage-ledger-and-entitlements.md)
  for authorization, migration, corrections, and the limits of recorded-spend enforcement.

## Apply migration

Not auto-applied. Run `docs/migrations/message_send_queue.sql` in the Supabase SQL editor
(or your usual migration path) before enabling multi-mode queue in production.
