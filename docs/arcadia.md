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

**Inline subagent activity.** The orchestrator conversation renders accepted `dispatch_subagent`
results as collapsed assignment rows after the assistant turn. Expand a row for its brief,
latest available progress/outcome, model, and a link to the child's conversation. Working and
blocked agents also appear in a compact strip outside the message scroll viewport; selecting
one expands and focuses its row without changing the composer target or dashboard mode.
The strip scrolls horizontally on small screens. Completed agents leave the strip while their
rows remain in the conversation. Failures and dry-run tool previews keep the normal tool UI.

Live status is correlated by `latestGoalId` from the existing subagent board endpoint and
inbound dispatch events. Older assignments never inherit a later run's progress. When the
current assignment has no retained parent dispatch (including direct sends), its current
activity appears at the end of the thread. Older rows with no matching live snapshot say
“Sent”; full historical results remain in the linked child conversation. This adds no polling
loop or transcript fetch. Rendering lives in `components/chat/subagent-activity.tsx` and
`chat-thread.tsx`; dispatch validation lives in `lib/arcadia/multitask/inline-dispatches.ts`.

**Layout.** Multiagent view is a **per-thread toggle** (default off). Working sandbox agents
do not force the dashboard. When on: chat shares the ordinary Arcadia canvas, without a
separate glass frame or thread-style badge. The header shows the current message recipient
instead of a dashboard title. Clicking that name fans out the orchestrator and subagents
as pills in roster order; choosing a recipient collapses the pills to the same left edge.
Selection changes styling without reordering the expanded slots. Mobile keeps that picker
in a horizontally scrollable row. The board shows condensed cards, with one board scroll
region and a docked composer stack so layers
do not paint over each other. Wide screens (`lg` / `MULTITASK_DASHBOARD_WIDE_MIN_PX`) keep
board + chat side by side at the original 70% chat / 30% board split. Focusing or selecting
an agent keeps both column widths stable.

**Thread viewport — Locked 2026-10-11.** Multiagent reuses Arcadia's `Chat` and the shared
`Conversation` component, including its instant bottom positioning on initial render.
The dashboard bounds the chat pane's height and lets that conversation own scrolling;
panel transitions anchor its scroll area rather than adding a second thread scroller.

CoreInput follows its container width in both layouts. Its morph-physics wrapper carries
the visible position and width across a window resize and the following breakpoint commit,
retargeting one spring if the user reverses direction. Focus and drafts survive; reduced
motion settles immediately. See [CoreInput layout continuity](./design/motion-and-text-timing.md#coreinput-layout-continuity).

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

Bundle-item selection, excerpts, explicit worker history, input preflight and attachment
paging are documented in [Subagent dispatch context](./aion/subagent-context.md).

**First-use guidance.** Opening Multiagent registers its controls tip with the existing
feature-hint system. Dismissal persists; replay tips can show it again. The tip explains
recipient selection and Ctrl+Q / Ctrl+W. Panel buttons show those shortcuts in tooltips
using the shared keyboard-key component; Organic Help lists them too.

**Composer.** In dashboard mode the chat uses the same live `sendMessage` →
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

**Side questions (`/btw`):** `/btw <question>` opens an unsaved side thread above the composer.
It answers from a compact snapshot of the thread (summary plus recent turns, no tools) and
works while the main turn streams. CoreInput takes the side thread's settings while it is
open and morphs back on close. See
[Composer preferences → `/btw`](../content/dev-docs/composer-preferences.md#btw-side-questions-arcadia).

## Tech + design (3 lines)
- **Stack**: Next.js (App Router) + React + AI SDK streaming + Clerk + Supabase
- **LLM**: shared `/api/chat` pipeline (context + tools + streaming UI events)
- **Design**: forest-chrome text hint + brown-glass cards (Arcadia sidebar variant)
