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

The sidebar creates an Arcadia thread and opens `/sandbox/arcadia/<id>` directly.
Direct visits to `/sandbox/arcadia` create a thread and redirect to its canonical URL. Use the
**Multiagent** control (top-right) to enter the multitask dashboard for that thread.

| Piece | Path |
|-------|------|
| Host + shell UI | `app/sandbox/arcadia/_components/multitask-*.tsx` |
| Running dashboard | `multitask-dashboard.tsx` + `send-target-picker.tsx` |
| Layout switch | `lib/arcadia/multitask/layout-mode.ts` (`overlay` vs `dashboard`) |
| Client model / demo roster | `lib/arcadia/multitask/` |
| Role → voice presets | `lib/arcadia/multitask/voice-assignment.ts` (also shown in the shell legend) |
| Speak ADR | [`docs/speak/decisions/20260925-multitask-subagent-speak.md`](./speak/decisions/20260925-multitask-subagent-speak.md) |

**Layout.** Multiagent view is a **per-thread toggle** (default off). Working sandbox agents
do not force the dashboard. When on: chat is confined with a Send-to picker; the board shows
condensed cards. Mobile uses one board scroll region and a docked composer stack so layers
do not paint over each other. Wide screens (`lg` / `MULTITASK_DASHBOARD_WIDE_MIN_PX`) keep
board + chat side by side.

**Toggle gate.** Flips are refused while `threads.active_stream_id` is set for that thread.
Local storage + BroadcastChannel sync same-browser tabs. Visible pages check other devices
every 2.5s while Multiagent is enabled or workers exist, and every 30s in ordinary chat.
Focus or returning to a visible tab triggers a check immediately. Column: `threads.arcadia_multitask_view`
(`docs/migrations/threads_arcadia_multitask_view.sql`).

**Initial load.** The server seeds the view flag and owned worker presence. Ordinary chat
starts no board, background-message, or heartbeat requests until workers are discovered or
Multiagent is opened. Existing workers continue updating with the dashboard off. Failed
presence reads preserve board discovery rather than treating unknown state as empty.
Both view and board requests are aborted on cleanup; hidden tabs skip network polls.
See [Chat and Arcadia initial load](./architecture/decisions/20261009-chat-arcadia-initial-load.md).

**Delegation gate — Locked 2026-10-08.** New user requests delegate to subagents only while
the thread's saved Multiagent flag is on. With it off, requests are answered in the current
chat without thought routing or new worker assignments. Both live sends and queued sends
check the saved flag; a retained Send-to selection cannot enable delegation.

**Orchestrator-authored dispatch (COA-258).** The orchestrator, not the router, decides what
each subagent receives. `dispatch_subagent` sends a brief the orchestrator wrote itself, plus
context: the user's words (each quote is checked against this thread), other subagents' output,
memories, and notes. The `worktable` tool keeps reusable context bundles on the orchestrator's
own thread row (`threads.subagent_worktable`, encrypted;
`docs/migrations/threads_subagent_worktable.sql`). A bundle can be sent again and again, and a
`live_subagent_output` item picks up an agent's latest reply on every send. Live items are
resolved when the dispatch goes out, so the child thread records exactly what was sent. The
worktable is private to the orchestrator. Subagents see only what is dispatched to them.

Limits:
- Targets must be existing children or roster slots.
- At most 4 dispatches per turn.
- Heartbeat-triggered turns may make at most 3 dispatches between user messages. The count is
  kept on the worktable, or read from the thread's own history when the worktable is
  unavailable. Heartbeat turns are steered to start the next unblocked step of work the user
  asked for (e.g. architecture drafting once research lands), not review or judging cycles.
  Only the orchestrator dispatches.

A message sent straight to one subagent is still delivered verbatim.
`ARCADIA_ORCHESTRATOR_DISPATCH_ENABLED=false` restores Jev router auto-dispatch. Code:
`lib/llm/subagents/worktable/`, `lib/llm/subagents/orchestrator/orchestrator-tools.ts`.

**Composer.** In dashboard mode the confined chat uses the same live `sendMessage` →
`/api/chat` path as Arcadia idle chat (user bubble + streaming reply). The Send-to picker
value is sent as `multitaskSendTarget` on the request body so the server can route or
delegate. `queueSendMode` is intentionally off here — enqueue alone never paints the turn
into the thread UI. The multi-mode queue still exists for backlog use; see
[`docs/message-send-queue.md`](./message-send-queue.md).

**Scripted showcase replay.** `lib/showcase/arcadia-multitask-demo.ts` preserves the original
demo scenario with a fresh state factory and a pure tick function. Live dashboard progress
comes from worker awareness and board polling. See the
[showcase isolation decision](./architecture/decisions/20261009-arcadia-showcase-progress.md).

**Model labels.** Both card layouts show a quiet `LLM · <name>` line, using the chat registry's
display name (or the exact model ID when it is absent from the registry). Dispatch persists
the server-selected model with the assignment; replies retain the model used for that run.
Board polling reads the newest assignment or reply. A new assignment cannot inherit a stale
model from an older reply. Undispatched slots show `Not assigned`; legacy threads without
model metadata show `Not recorded`. This describes the latest assignment or reply, rather
than inferring a model from the viewer's composer selection. Direct user turns gain their
model label when the reply is persisted.

**Speak to** ends any live call and mints a **new** Realtime session with that subagent's
Realtime voice id, instructions seeded with goal + current progress. While that session is
bound:

- `POST /api/ai/speak/realtime/progress` — silent context (no announce)
- `POST /api/ai/speak/realtime/milestone` — spoken announce (`response.create`)

**Queued composer (optional multi mode):** CoreInput can still take `queueSendMode` when a
shell wants enqueue-only submits; do not enable it for the Arcadia multitask orchestrator
window if visible streaming is required. See [`docs/message-send-queue.md`](./message-send-queue.md).

## Tech + design (3 lines)
- **Stack**: Next.js (App Router) + React + AI SDK streaming + Clerk + Supabase
- **LLM**: shared `/api/chat` pipeline (context + tools + streaming UI events)
- **Design**: forest-chrome text hint + brown-glass cards (Arcadia sidebar variant)
