# Arcadia

Arcadia is a **sandbox chat experience** inside Organic LLM: a safe lab for experimenting with system prompts, context compilation, toolkits, response styles, and UI variants—without destabilizing the main chat.

## Why it exists
- A place to iterate quickly on high-risk UX + LLM changes (prompt/tool/context shifts) with minimal coupling.
- A proving ground for changes that later graduate into the main chat route and shared components.

## What Arcadia is (scope)
- Uses the shared chat shell (`components/chat/chat.tsx`) and the shared thread persistence model (Supabase `threads` + `messages`).
- Threads created from Arcadia are tagged with routing metadata (`threads.feature`, `threads.path`) so the sidebar can route correctly.
- Arcadia-specific UI variants can exist (e.g. sidebar row styling) while still sharing core primitives and contracts.
- **Multitask shell** (sandbox): condensed subagent characters with Speak-to. See
  [Multitask shell](#multitask-shell).

## What Arcadia is not (non-goals)
- Not a separate persistence stack or separate auth model.
- Not guaranteed-stable UX; breakage here is acceptable as part of iteration.
- Not a production multi-agent backend — the multitask roster is an honest client model until a real swarm exists.

## UX contract
- Thread list API (`GET /api/chats`) returns thread metadata including `feature/path`.
- Sidebar rendering can be filtered via **Coalescence Mode**:
  - OFF: show main chat threads only
  - ON: show threads from all features (including Arcadia)

## Multitask shell

Open any Arcadia thread (`/sandbox/arcadia` → redirect to `/sandbox/arcadia/<id>`). Use the
**Multitask** control (top-right) to show the shell.

| Piece | Path |
|-------|------|
| Host + shell UI | `app/sandbox/arcadia/_components/multitask-*.tsx` |
| Running dashboard | `multitask-dashboard.tsx` + `send-target-picker.tsx` |
| Layout switch | `lib/arcadia/multitask/layout-mode.ts` (`overlay` vs `dashboard`) |
| Client model / demo roster | `lib/arcadia/multitask/` |
| Role → voice presets | `lib/arcadia/multitask/voice-assignment.ts` (also shown in the shell legend) |
| Speak ADR | [`docs/speak/decisions/20260925-multitask-subagent-speak.md`](./speak/decisions/20260925-multitask-subagent-speak.md) |

**Layout.** When any subagent is `working` or `blocked`, Arcadia switches to a **dashboard**:
chat is confined to a pane (composer stays enabled), a **Send to** picker chooses
orchestrator vs a subagent, and the board keeps the condensed cards visible. When the
roster is idle, the floating Multitask overlay from the first slice remains.

**Composer / queue.** In dashboard mode, `Chat` passes `queueSendMode` and
`queueTargetAgentId` (from the Send-to picker via `queueAgentIdFromSendTarget`) into
`CoreInput`, so submit hits `POST /api/chat/queue` instead of `sendMessage`. The same
picker value stays on the request body as `multitaskSendTarget`. Idle overlay keeps the
normal send path. See [`docs/message-send-queue.md`](./message-send-queue.md).

**Speak to** ends any live call and mints a **new** Realtime session with that subagent's
Realtime voice id, instructions seeded with goal + current progress. While that session is
bound:

- `POST /api/ai/speak/realtime/progress` — silent context (no announce)
- `POST /api/ai/speak/realtime/milestone` — spoken announce (`response.create`)

**Queued composer (multi mode):** when the shell wires the shared CoreInput, pass
`queueSendMode` so submits enqueue via `/api/chat/queue` instead of blocking on stream/quota.
See [`docs/message-send-queue.md`](./message-send-queue.md).

## Tech + design (3 lines)
- **Stack**: Next.js (App Router) + React + AI SDK streaming + Clerk + Supabase
- **LLM**: shared `/api/chat` pipeline (context + tools + streaming UI events)
- **Design**: forest-chrome text hint + brown-glass cards (Arcadia sidebar variant)

