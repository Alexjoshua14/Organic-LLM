# CoreInput snapshot morph

How CoreInput moves between remembered settings when the user changes scope: opening or
closing a `/btw` side thread, switching threads, or moving between areas (Arcadia, Aion,
Rabbit Holes). For what a snapshot holds and how it is stored, see
[Composer preferences](../../content/dev-docs/composer-preferences.md#per-scope-snapshots).

**Related code**

- Timing constants: [`lib/core-input/morph-timing.ts`](../../lib/core-input/morph-timing.ts)
- Timeline: [`lib/core-input/morph-timeline.ts`](../../lib/core-input/morph-timeline.ts)
- Sheen and pulse: [`styles/CoreInputMorph.css`](../../styles/CoreInputMorph.css)
- Driver: `morphTo` in [`components/chat/core-input/core-input.tsx`](../../components/chat/core-input/core-input.tsx)

## What the user sees

One soft sheen sweeps left to right across the composer. As it passes, each control whose
value differs changes in turn: model, then effort, context effort, search, memory, and speech.
Each control flashes a thin outline as its value lands. Controls that already match are left
alone.

Model leads because effort and context effort are clamped against it. The toggles then follow
in the order they sit in the footer, so the sweep and the changes travel the same way.

## Timing

| Token | Value | Why |
|-------|-------|-----|
| `CORE_INPUT_MORPH_MS` | **400ms** | Upper end of the NN/g 100–500ms band, so the change can be read, but under the ~500ms point where motion starts to feel like waiting |
| `CORE_INPUT_MORPH_FIRST_STEP_MS` | 40ms | The sheen leads by one beat, so the eye is already moving when the first value changes |
| `CORE_INPUT_MORPH_SETTLE_MS` | 140ms | Quiet tail, so the last field's pulse finishes inside the morph |
| `CORE_INPUT_MORPH_PULSE_MS` | 220ms | Per-field outline; about Material's 200ms exit |
| `CORE_INPUT_MORPH_FAST_FORWARD_RATE` | 5× | See below |

Changes are spread evenly between 40ms and 260ms. With all six fields changing, that is a
~44ms stagger, inside Carbon's guidance to keep a staggered set under 500ms.

**Approved range:** 300–450ms total. Below 300ms the sequence reads as one blink and the "it
remembered" moment is lost. Above 450ms the composer feels busy every time the user switches
threads.

## Interruption: touch to fast-forward

A pointer-down or key-down anywhere in CoreInput during a morph raises the playback rate to
5×. Remaining steps still run, in order, so the sequence never breaks; at most 80ms is left.
This follows the HIG rule that people should never wait on animation.

Two paths settle the morph instantly instead:

- **Submit.** A send mid-morph finishes the morph first, so the request carries the settings
  being morphed to. The caller's refs are written synchronously before `sendMessage` runs.
- **Changing a setting.** A user change finishes the morph, then applies the change, so a
  pending step never overwrites what the user picked.

## When it does not morph

- **Reduced motion:** settings apply instantly; the sheen and pulse are hidden by CSS as well.
- **First paint without a scope:** sandbox labs and other unscoped composers have nothing to
  morph from.
- **Nothing changed:** two scopes with identical settings switch silently.

## First paint

Chat and Arcadia read a small cookie mirror of composer preferences on each request. A
validated thread snapshot (or its area's fallback) seeds the controls and the two experimental
flags, so return visits paint their saved values immediately. Local storage and background
sync remain authoritative after hydration; a newer snapshot uses the existing morph.

The cookie uses the snapshot codec, retaining four area entries and eight recent other scopes
(under 300 bytes for the value). It contains scope hashes and preferences, never draft text or
messages. Missing, malformed, or unknown-model cookies provide no seed. `/btw` edits are never
mirrored. The cookie is a display hint; model access remains enforced by the chat API.

When no valid seed exists, the server's defaults must not paint and then swap:

- **Unseeded settings controls are hidden on the server.** Persona, search and memory, speech,
  preview, model and effort, and context effort keep their space but stay hidden until the
  client has applied the saved settings. They then fade in over
  `CORE_INPUT_SETTINGS_REVEAL_MS` (150ms, provisional), or instantly under reduced motion.
  Add files, the thread clipboard, mic, and send don't depend on settings, so they paint
  immediately. Client-only remounts keep settings visible while the scope morph runs.
- **The persona chip holds its space** with an invisible copy of itself while its session
  loads.
- **The textarea server-renders one row**, matching `minRows`.

## Changing this

Prototype in `/sandbox/prototypes/core-input` before promoting new values. Keep the order
rule (model first) and the fast-forward semantics; tune durations within the approved range.
