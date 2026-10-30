# Stage voice and composer integration

Stage reuses the app-wide voice provider and CoreInput through an explicit `stage-beta`
variant. The beta layout, options popover, and preference isolation are opt-in; other
CoreInput call sites retain their existing layout and legacy preference behavior.

Stage sessions advertise only `stage_turn`. The server checks the owning active session
and its Stage flag before executing it. Voice and text use `lib/stage/turn.ts`, sharing
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
