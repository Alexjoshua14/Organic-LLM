# Ambient voice: a session that outlives the page, and a bar that says so

**Status:** Accepted — FluidGlass material approved by the user after its cost was flagged
**Date:** 2026-09-22
**Affects:** `app/layout.tsx`, `components/voice/*`, `hooks/use-realtime-voice.ts`,
`hooks/use-voice-{audio-levels,screen-context}.ts`, `lib/speak/{ambient-context,ambient-item,transport,waveform-geometry,voice-visual-state}.ts`,
`app/api/ai/speak/realtime/{session,active,context}/route.ts`, `lib/rate-limit/speak-realtime.ts`

## Context

Speak Live worked on `/speak` and nowhere else. `useRealtimeVoice` was owned by
`LiveVoiceStage`, so the `RTCPeerConnection`, the mic `MediaStream`, and the `<audio>` sink all
died on the first route change — navigating to Arcadia silently hung up the call.

Three things had to be true at once:

1. A call survives navigation across the whole app.
2. The user can always tell their microphone is open, on every route.
3. The agent knows what is on screen without being asked about it.

## Decision

### 1. The session moves to the root layout

`VoiceSessionProvider` is mounted in `app/layout.tsx`. The App Router preserves the root layout
across client-side navigation, so the peer connection is never unmounted. No relay, no worker,
no polling — the fix is entirely about *where* the hook lives.

`LiveVoiceStage` became a consumer. Gen-UI output moved with it
(`lib/speak/voice-visual-state.ts`): a card the agent rendered should still be there when the
user comes back from another surface, which is impossible while the state lives in a page.

### 2. Reload resumes rather than relays

A hard reload destroys the peer connection and nothing client-side can prevent it —
`RTCPeerConnection` is window-only, so no worker can hold it. Two options were put to the user:

| Option | Audio gap | Cost |
|--------|-----------|------|
| Server-side media relay (LiveKit / `werift`) | none | new dependency, a long-lived host outside Vercel serverless, an extra latency hop, media egress |
| Resume from the server session record | ~1s of reconnect | none |

**Chosen: resume, behind a transport interface.** `lib/speak/transport/voice-transport.ts`
defines the seam; `createWebRtcVoiceTransport` is today's implementation and a relay can be
added as a second one without the hook, the provider, or any UI changing shape.

`GET /api/ai/speak/realtime/active` reports a session that outlived its page, and the mint route
accepts `resumeSessionId`. Two properties matter:

- **`expiresAt` is inherited, not recomputed.** Otherwise refreshing the page would reset the
  deadline and `SPEAK_SESSION_MAX_MINUTES` could be extended indefinitely by reloading.
- **`continuityStartedAt` is carried separately from `startedAt`.** The live bar's clock reads
  the former, so a reload does not restart the timer at zero while billing still measures the
  new call honestly. The predecessor is settled via `endSpeakRealtimeSession` before the
  successor is minted, which also frees its concurrency slot — resume must settle *before* the
  start check or every reload would be rejected for concurrency.

### 3. Screen context is a silent system message

There is **no `.thinking` event** in the Realtime API — that was the initial guess and it does
not exist. The documented path is `conversation.item.create` carrying a **system** message, sent
*without* a following `response.create`. OpenAI's own type docs for
`RealtimeConversationItemSystemMessage` state the intent:

> For major changes to the conversation's behavior, use instructions, but for smaller updates
> (e.g. "the user is now asking about a different topic"), use system messages.

It cannot trigger a reply, because server VAD only opens a response off a committed *audio*
buffer. It is also not a user turn, so the model has nothing to answer. That is structural but
not absolute — a chatty model can still volunteer "I see you've opened…" — so `AMBIENT_PREFACE`
closes it off in words as well.

Rejected: `session.update` with new `instructions` rewrites the whole preamble on every
navigation and re-bills it each turn; an out-of-band `response.create` produces output we would
only discard.

Surfaces register an **id**, not content (`useVoiceScreenContext`). The server assembles the body
(`lib/speak/ambient-context.ts`) because summaries, compiled Strata documents and rabbit-hole
graphs need privileged reads, decryption and ownership checks. It cannot *send* it — the data
channel is in the browser — so the route returns text and the provider forwards it.

Budget is **600 tokens**, a third of the resume preamble's 1.8k, because ambient context is
re-sent on every navigation and re-read on every model turn. A surface the caller does not own
resolves to an empty body rather than an error: a failed ambient push must never disturb a live
call.

### 4. The waveform is a ribbon of interpolated curves

Direction came from the user's generative art. A ribbon is not a shape with an outline — it is a
band of many thin strokes interpolated between two wandering driver curves, where stroke
*density* creates the light. So every interpolated curve is stroked; they are the render, not
scaffolding.

Three drivers (Volume, Treble, Bass) in that fixed adjacency order, each a two-harmonic spatial
basis whose amplitude its audio band modulates, with slow time drift so the ribbon breathes
during silence. Baselines are spread monotonically in render order so the two bands stack into
one coherent ribbon instead of folding through each other.

**Clipping fix.** The first implementation lost ~6.8px off the top and ~6.2px off the bottom of
a 32px bar — peaks shaved flat against the viewBox. Two causes: each driver's harmonic weights
summed to more than 1 (1.34, 1.12, 1.28) while the amplitude constant assumed ±1, and nothing
related amplitude to how much room the outer baselines actually had. Both are now structural:
`normalizeBasis` forces each driver's offset into [-1, 1], and `availableHeadroomPx` *derives*
the swing budget from the outermost baselines, so retuning them can never silently reintroduce
clipping. A test sweeps 5 levels × 900 phases × 4 bar heights and asserts the bounds. The ribbon
still fills ~92% of the bar — clipping was not traded for timidity.

## Performance

The user asked specifically whether morph-physics was affordable here. It is, decisively.

Per-frame CPU, measured on an M-series Mac (Bun, 60k iterations after warmup):

| Work | µs/frame | % of a 60fps budget |
|------|----------|---------------------|
| `solveSpring` — the glow spring | **0.15** | 0.001% |
| `buildRibbonCurves` — 19 curves | 1.07 | 0.006% |
| Waveform full frame (curves + 19 path strings) | 29.8 | 0.18% |

morph-physics is ~200× cheaper than the geometry it sits beside and ~4 orders of magnitude
inside a frame. There is no case for hand-rolling an easing curve to avoid it.

Path-string generation dominated at 66µs/frame until `toFixed(2)` was replaced with
`Math.round(n * 100) / 100` — **2.2× faster for coordinates identical to the last digit**
(verified: max delta 0.0). That single change is most of the waveform's cost.

Standalone browser measurement of the composed bar (Chromium, 8s window after 4s warmup):
empty control held **59.9 fps, p95 17.5ms, heap 10.3 MB**. The glow layer alone measured p50
17.9ms — indistinguishable from baseline, consistent with the 0.15µs figure. Full-stack
attribution with FluidGlass was not completed: the harness suspends unfocused tabs for ~1s at a
time, which contaminates p95 beyond what the deltas can be read through. `/sandbox/prototypes/voice-bar`
exists to finish that measurement in a real signed-in browser.

Cost controls in the shipped code:

- The glow's `FrameLoop` **stops when the spring settles** (~0.5s after each per-second tick),
  so the steady state between ticks is zero frames. Paused when the tab is hidden; skipped
  entirely under `prefers-reduced-motion`.
- The waveform writes `d` straight to path refs. React renders the `<path>` list exactly once —
  the count is a compile-time constant, so there is nothing to reconcile. Going through state
  would re-render the provider, and therefore the app, 60 times a second.
- The analyser reads a fixed 32 frequency bins and 32 time-domain samples per stream. That work
  does **not** grow with curve count: 19 curves and 190 cost the same.
- `AudioContext` is closed on teardown, releasing the audio path and the OS recording indicator.

## FluidGlass, and what it cannot do

The user chose FluidGlass over the CSS primitives after the trade-off was put to them, adding
`@react-three/drei` and `maath`.

**WebGL cannot refract the DOM behind its own canvas.** Nothing can, short of rasterizing the
page into a texture every frame. So the bar is deliberately two stacked materials: `glassPreview`
does the real page blur via `backdrop-filter`, and the canvas on top contributes what CSS cannot
— thickness, chromatic aberration, anisotropic streak, moving specular, and refraction of an
internal lit backdrop. It reads as a lit 3D slab; it is not bending actual page pixels.

Guards: `samples: 4` and `resolution: 96` (a 32px strip resolves no more), DPR capped at 1.5,
`powerPreference: "low-power"`, and `frameloop: "demand"` when hidden or reduced-motion — zero
frames rendered, not throttled frames. It mounts only while a call is live.

## Consequences

- Voice is now app-wide state. Anything that wants to know about it reads `useVoiceSession`.
- The bar is not dismissible. Ending the call is the only way to remove it — that is the point.
- `useVoiceScreenContext` is safe outside the provider (it no-ops), so surfaces can adopt it
  without caring where they are mounted. Chat, Strata and rabbit holes are wired; other surfaces
  send `{ kind: "none" }`, which explicitly marks prior context stale.
- A relay remains available later without touching UI, via `VoiceTransport`.

## Open

- **Full FluidGlass GPU attribution** — blocked on a signed-in browser; the lab is built.
- **Mobile battery** under a long call with a live WebGL context is unmeasured. If it bites, the
  cheapest lever is dropping the canvas on coarse pointers and keeping `glassPreview`.
- The **relay-vs-resume** choice is settled for now but recorded as reversible on purpose.
