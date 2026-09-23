# Idle auto-pause: a quiet call ends itself, and resuming is one tap

**Status:** Accepted — behaviour and the 15–20s range set by the user
**Date:** 2026-09-22
**Amends:** [Ambient voice presence](./20260922-ambient-voice-presence.md) — "the bar is not
dismissible; ending the call is the only way to remove it" now has a third state, *paused*.
**Affects:** `lib/speak/voice-idle.ts`, `lib/speak/realtime-events.ts`,
`hooks/use-realtime-voice.ts`, `components/voice/voice-{session-provider,live-bar,live-bar-host}.tsx`,
`app/speak/_components/LiveVoiceStage.tsx`

## Context

With the session in the root layout, a call now outlives the page that started it, so it is easy
to forget one is open. An idle call still costs: it holds a concurrency slot, runs the wall-clock
meter toward `SPEAK_SESSION_MAX_MINUTES`, and keeps a hot mic that room noise can turn into a
billed turn.

## Decision

### What counts as quiet

All of these, continuously, for `SPEAK_IDLE_PAUSE_MS` (**20s**, approved range 15–20s):

| Activity | Starts | Ends |
|----------|--------|------|
| User speaking | `input_audio_buffer.speech_started` | `…speech_stopped` |
| Model working | `response.created` | `response.done` |
| Model audio playing | `output_audio_buffer.started` | `…stopped` / `…cleared` |
| Tool executing | `function_call_arguments.done` | `/tool` round-trip settles |

Playback is tracked separately from the response because on WebRTC it outlives `response.done`.
Pausing on `response.done` alone would cut a long answer off mid-sentence. The classifier now
emits `assistant_playback_started` / `_stopped` for these events. Previously
`output_audio_buffer.started` was ignored.

The window restarts from zero when the last activity ends; it does not accumulate. An activity
whose end never arrives keeps the call open, which is the old behaviour, rather than risking a
pause mid-answer. Navigating the app is not activity. The rule is about the conversation, not
the user's attention.

20s rather than 15s because the common false positive is someone thinking before they answer,
and every resume costs a reconnect (~1s) plus a re-sent thread preamble.

### Pause ends the call; it does not hold it

`pauseForIdle` runs the normal teardown: it flushes turns, settles the server session, closes the
peer connection and stops the mic tracks. So a paused call bills nothing, holds no slot, and the
OS recording indicator goes off.

Rejected: keeping the server session alive and resuming with `resumeSessionId`. That path
inherits `expiresAt` (on purpose, so reloads cannot extend a session), so a pause longer than the
remaining budget would resume into an expired session, and the slot would stay held the whole
time.

### Resume continues the same thread

`resume()` mints with an explicit `threadId`, the one the paused call was writing to. The session
route already honours it, with an ownership check, over the `resume-latest` policy. It rehydrates
through the same resume preamble (summary plus recent turns) as any resumed thread, and ambient
screen context is re-pushed on connect. A failed resume leaves the call paused, so the bar keeps
offering another try.

### The paused bar

The bar stays where it was, because that is where resume lives. It must not read as live, since
this is the one state where the mic is off:

- no waveform, no clock, no lumen dot (muted grey instead);
- **"Paused · mic off"** in words, and "Voice paused — microphone off" for screen readers;
- a **Resume** control, plus **✕** to end it for good;
- FluidGlass is dropped for the CSS glass, so no WebGL loop runs while nothing is live. The surface
  is keyed on the state so a resume remounts the canvas from `loading`.

A resume in flight renders as an ordinary connect. After a failure the label reads
"Couldn't resume", with the reason in the button's title. On `/speak`, the mic button resumes and
the status line explains the pause.

`/sandbox/prototypes/voice-bar` renders the live, paused and failed-resume states side by side.

## Consequences

- The paused state is client-only. A hard reload while paused drops the bar; the thread is intact
  and the next start resumes it under `resume-latest`.
- Every pause/resume cycle re-sends the resume preamble (≤ ~1.8k tokens). Frequent short pauses
  cost more than one long call; that is the case for the top of the range.
- `idlePauseMs` is a hook option so tests can shorten it; production reads the constant.
