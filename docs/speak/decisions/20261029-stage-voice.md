# Stage voice and composer integration

Stage reuses the app-wide voice provider and CoreInput through an explicit `stage-beta`
variant. The beta layout, options popover, and preference isolation are opt-in; other
CoreInput call sites retain their existing layout and legacy preference behavior.

Stage sessions advertise `stage_turn` and the read-only `read_stage` (added 2026-11-12, see
below). The server checks the owning active session and its Stage flag before executing either. Voice and text use `lib/stage/turn.ts`, sharing
budget checks, turn leases, idempotency, conversation persistence, and the existing
asynchronous designer queue. A stable request ID derived from session/call IDs prevents
redelivered voice tool calls from scheduling duplicate designs.

Stage sessions do not create a separate Speak thread. The Stage conversation is canonical;
voice reads the returned reply. Stage mode and composer settings are captured in the
session record and inherited on reload or idle resume. Composer changes affect typed
turns immediately and voice on the next connection.

The Stage surface registers its revision with the screen-context mechanism. Context is
assembled server-side from the authenticated owner's Stage; typed exchanges and widget
changes reach the voice model silently. While connected, the Stage client polls for
voice-originated revisions using the same cadence as designer updates.

CoreInput claims the existing voice drawer slot. Stage reserves space above it while the
bar is visible so the bar does not cover the latest response. The microphone, audio sink,
permission recovery, idle pause, and end controls remain owned by the existing voice
provider and transport.

Stage also schedules up to two bounded workers through the existing worker-goal runtime.
Assignments and results are part of the encrypted Stage snapshot. Workers use the shared
economy model policy, ZDR, budget hooks, and per-run cost limits. Distinct worker leases
permit parallel goals and deduplicate recovered callbacks. Children cannot delegate.

The parent and each running child have explicit reservations, exposed to the model by `stageAgentReservations`. The parent owns x12 y8 w8 h14; child slots own x7 y23 w8 h8 and x17 y23 w8 h8. The designer shares the two active slots with workers; queued work owns no cells until it claims a slot atomically.
Only conflicting widgets move to make room; if they cannot fit, delegation is declined
without partially moving the canvas. Completion, failure, and cancellation release the
reservation. Organic Activity Marks show each live child's state, settle on exit, and
unmount; results remain in conversation/activity history.

Stop is an owner-scoped DELETE, not a cosmetic hide. It records cancellation before
aborting locally. Running workers check durable cancellation across instances, and the
completion mutation fences late responses. Stale workers are marked failed after the
run ceiling plus a margin, so a killed process cannot reserve canvas space indefinitely.

Preview review exposed two separate failures: the original parent's eight-row reservation
was shorter than its rendered mark and caption, and the designer's discriminated union
emitted provider-rejected `oneOf`. The parent now has a bounded fourteen-row reservation,
and the canvas has a minimum useful size with native scrolling rather than compressing
entity content into overlapping cells. Existing conflicting pieces are repaired on read.
The designer schema uses `anyOf` alternatives and was verified with a live synthetic call.

Worker replies carry author metadata and remain distinct in the main response zone.
Arrival selectors expose new work without replacing the user's current reading surface.
Mermaid work products receive validated grid cells; the response caption keeps prose,
and full source remains available in Conversation.

## Seeing Stage content (2026-11-12)

The Stage `[Screen]` item had been arriving as a header alone. `stageVoiceContext` serializes
layouts, the navigation rules, four messages and the summary, and is several times the 600-token
ambient cap, so `fitAmbientBody` dropped the whole section and left only "The user is on their
Stage". Voice knew where the user was but not what was there.

Two layers now, both quoted data:

- **`[Screen]`** uses `stageAmbientContext` (`lib/stage/voice-read.ts`). It contains the
  current view name, visible pieces with short previews, other pieces by title, subagent
  status, design status, and a little recent conversation. It shrinks step by step to fit
  whole and never disappears. `stageVoiceContext` is unchanged for the mint and subagents.
- **`read_stage`** returns real content on demand: note text, diagram source, recipes, a
  chat piece's latest messages, subagent results and, optionally, the latest Stage exchanges.
  - Chat pieces are read through `getThreadScreen` with `expectedOwnerId`. A failure marks
    that piece unavailable and the rest of the read still succeeds.
  - The result is capped at about 6k characters, because function outputs stay in the
    Realtime context under the 8k-token retention window.
  - The model calls it silently (principle 2) and passes ids from `[Screen]`. With no ids it
    falls back to the view the Stage last recorded, which follows Stage turns and can lag a
    manual tab switch.

The voice model may answer questions about existing content directly from `read_stage`.
Anything that creates, changes or delegates work still goes through `stage_turn`.

Open question: a question answered this way is not written to the Stage conversation,
because Stage sessions have no Speak thread. Typed Stage turns also do not see note or
diagram text, since the central agent's context omits widget content. Both are left for a
decision.
