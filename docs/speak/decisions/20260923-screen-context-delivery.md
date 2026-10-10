# Screen context delivery: tell the model, describe the screen, keep one current item

**Status:** Accepted — direction chosen by the user from a brainstorm on 2026-09-23
**Date:** 2026-09-23
**Supersedes:** the per-item preface in [Ambient voice presence](./20260922-ambient-voice-presence.md)
§3, the chat body in the same section, and the "superseded items accumulate" consequence in
[rabbit-hole awareness](./20260922-rabbit-hole-voice-awareness.md). The transport, a silent
`conversation.item.create` system item, stands.
**Affects:** `lib/system-prompt/speak-realtime.ts`, `lib/speak/{ambient-item,ambient-context,realtime-events}.ts`,
`lib/schemas/speak-screen-context.ts`, `hooks/{use-realtime-voice,use-chat-voice-surface}.ts`,
`components/chat/chat.tsx`, `components/voice/{voice-sees-chip,voice-live-bar,voice-live-bar-host,voice-session-provider}.tsx`,
`app/api/ai/speak/realtime/context/route.ts`, `data/supabase/chat.ts`

## Context

Voice did not understand when a chat was open. Tracing the pipeline found five causes, most
likely first:

1. **The instructions never mentioned screen context.** The only framing was a paragraph of
   prohibitions in every item — "not a request… do not respond… do not acknowledge…". Voice
   models default to "I can't see your screen", and nothing contradicted it.
2. **A chat was pushed once and never again.** The key was the thread id alone, so text typed
   during a call never reached voice, and a new chat stayed "It has no summary yet".
3. **A summary is not what is on screen.** Voice got a condensed recap; the user is looking at
   the last few messages, and the title was deliberately not sent.
4. **Gaps.** Arcadia threads keep their summary where voice does not read it. The home composer
   has no thread yet. An empty body was never retried.
5. **Items piled up.** Each navigation added another description for the model to arbitrate.

## Decision

### 1. The instructions carry behaviour; items carry a label

Every session's instructions gain a **Screen awareness** section. It says that `[Screen]` items
describe what the user has open, that the model can see what they describe, that the newest wins,
that items are never announced, and to say so when there is none. It sits in the cached preamble,
so it is paid for once.

Items open with `[Screen]` and nothing else. The prohibitions moved to the instructions.

### 2. A chat is described as it looks

Title, then the latest messages, then the rolling summary, inside the existing 600-token budget:

| Part | Budget | Why |
|------|--------|-----|
| Title | ≤120 chars | Orientation; titles are stored unencrypted, so no decrypt |
| Latest messages | **own cap: 300 tokens**, ≤600 chars each, from the newest 6 | What is on screen. Capped so every push does not become a second copy of the chat — each item is re-read on every model turn |
| Summary | whatever the budget has left | Background; sized to the remainder so `fitAmbientBody` never drops it whole |

Messages are walked newest-first until the next one would not fit, then read oldest-first. The
newest always survives, clipped if it alone overflows. Only text parts go: tool calls, reasoning
and generated UI are left out.

### 3. Freshness: a revision per finished exchange

The chat descriptor gains `revision`, the id of the last *settled* message, and it is part of the
surface key. `useChatVoiceSurface` holds it through `submitted` and `streaming` and moves it on
`ready` or `error`. The server reads the database, and `saveChat` runs in the stream's `onFinish`
before the stream closes, so on `ready` the exchange is persisted. The summary refresh is
fire-and-forget and may lag one exchange; the latest messages cover it.

### 4. One current item

Each push creates an item with our own id and then deletes the previous one — add before delete,
so there is never a moment with no screen item. A surface that yields nothing (not owned, not
found, failed) still replaces the old item, with `AMBIENT_CLEARED_BODY`. Otherwise the model goes
on describing the page the user left.

Both events carry an `event_id` prefixed `ambient_`. Realtime error events name the client event
that caused them (`error.event_id`), so an error from our housekeeping is dropped rather than
shown. The expected case is a delete racing `retention_ratio` truncation.

### 5. A dev-only "Sees:" chip

`buildAmbientContext` now returns `{ body, label, reason? }`, and `/context` passes `label` and
`reason` through. Neither reaches the model. In development, the live bar shows what voice was
last told ("Chat · Espresso grinders"), the exact pushed text on hover, and why when there was
nothing to describe. It stays dev-only until the private-thread decisions settle what a
user-facing version should show.

## Consequences

- The model holds one screen item at a time. Superseded items no longer accumulate, and cost is
  bounded by the current push, not the navigation history.
- A chat push costs at most ~600 tokens; the recent-message cap keeps it well below "the whole
  thread twice".
- `VoiceSessionProvider` accepts `transportFactory` and `idlePauseMs`, passed through to the hook,
  so tests can run the real provider over a fake transport.

## Open

- **Arcadia threads.** Their summary lives in `threads.conversation_summary`; voice reads
  `thread_summaries`. They get title and messages but no summary.
- **Home composer.** No thread exists until the first send, so voice gets "nothing on screen".
- **Private threads.** Every chat reader, this one included, will need to respect the private
  flag once its decisions are made.
- **Selection as context** ("what does *this* mean" with highlighted text) was agreed as a later
  step.
- **Does the model use it?** The unit tests prove what is sent, not how the model behaves. A small
  eval — push context over the Realtime API in text mode, ask "what am I looking at?" — would
  close that loop.
