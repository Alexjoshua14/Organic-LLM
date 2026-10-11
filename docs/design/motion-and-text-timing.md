# Motion & character text timing

Design backbone for **status labels**, **loading states**, and **character-level text
transitions** in Organic LLM. Compiled from Apple HIG, Material 3, IBM Carbon, Android
Compose, Motion.dev, and Nielsen Norman Group guidance (2026 research pass), then
mapped to our production knobs.

**Related code**

- Timing constants: [`lib/chat/processing-text-burn-timing.ts`](../../lib/chat/processing-text-burn-timing.ts)
- CSS vars / keyframes: [`styles/ProcessingTextBurn.css`](../../styles/ProcessingTextBurn.css)
- Component: [`components/chat/processing-text-burn.tsx`](../../components/chat/processing-text-burn.tsx)
- Wrappers: `ChatThinking` / `ChatReasoning` / `ChatSearching` in [`components/chat/chat-loading.tsx`](../../components/chat/chat-loading.tsx)
- Chat *route* loading (thread hydrate): [`lib/chat/chat-page-loading-timing.ts`](../../lib/chat/chat-page-loading-timing.ts) + [`styles/ChatPageLoading.css`](../../styles/ChatPageLoading.css) + [`components/chat/chat-page-loading.tsx`](../../components/chat/chat-page-loading.tsx)
- Lab: `/sandbox/prototypes/llm-states` → **Processing burn (proto)**

---

## What the research does *not* say

No major design system publishes a single universal “ms per character” for every use case.
They publish **budgets**, **stagger bands**, and **principles**. We treat those as ranges
and pick **low-end** values for functional chat status so motion stays responsive.

---

## Leading-system guidance (summary)

### Apple Human Interface Guidelines

- Motion should be **purposeful, brief, and precise**.
- Do not force users to wait for animation; allow cancel / interruption.
- Avoid heavy motion on **frequent** interactions.
- Always support **Reduce Motion**.

No per-character numeric spec — use for product attitude, not for exact stagger.

### Material Design 3

- Exit ≈ **200ms**; enter ≈ **250–400ms** for standard transitions.
- Duration tokens step **50 / 100 / 150 / 200…** ms.
- Duration should scale with **size / travel**; avoid feeling like a wait.
- Official Compose typewriter sample: **50ms** between characters (+ demo start delay).

### IBM Carbon

- Stagger list/table entrances ≈ **20ms** between items.
- Keep total staggered choreography within ≈ **500ms** (shorten stagger if many items).

Closest system-level “don’t let stagger drag” rule.

### Motion.dev (Framer Motion ecosystem)

Documented character-stagger examples:

| Pattern | Stagger |
|---------|---------|
| Split-text reveal (common) | **30ms** (`stagger(0.03)`) |
| Split-text / scramble | **50ms** (`stagger(0.05)`) |
| Rolling label per-char | **25ms** (`stagger(0.025)`) |
| Typewriter interval | **~50ms** |

Also: put the full string in an accessible label; don’t announce every glyph.

### Nielsen Norman Group

- Most UI motion: **100–500ms** total.
- Simple feedback ≈ **100ms**.
- Beyond **~500ms**, motion often feels like delay.
- Prefer the **shortest** duration that isn’t jarring; too-long is more common than too-short.
- Exits should be **shorter** than entrances.

### Practical industry bands (typewriter / split text)

| Use case | Common stagger |
|----------|----------------|
| Typewriter / streaming reveal | **35–70ms**/char (often **50ms**) |
| Split-text fade/slide | **25–50ms**/char |
| List/table stagger | **~20ms**/item |
| Delete / outgoing | **20–45ms**/char (faster than reveal) |
| Per-char micro pulse | **~80–100ms** duration |

Avoid:

- **&lt;15–30ms**/char for readable status text (jitter / hard to track)
- **&gt;100ms**/char for functional status (feels sluggish)
- **&gt;500ms** *total* for frequent status swaps when the label is short

---

## Organic LLM decisions (approved)

We treat processing-label swaps as **functional status feedback**, not hero/onboarding
cinema. Prefer the **lower part** of research ranges.

### Production tokens (`ProcessingTextBurn`)

| Token | Value | Rationale |
|-------|-------|-----------|
| Outgoing stagger | **25ms**/char | Motion rolling-label / lower typewriter band; exits snappy |
| Incoming stagger | **30ms**/char | Motion split-text default (`0.03`) |
| Incoming initial delay | **150ms** | Overlap choreography without a long pause (was 400ms) |
| Per-char duration | **80ms** | Near NN/G micro-feedback; slightly under 100ms |
| Incoming opacity settle | **250ms** | Material enter short-band |
| Color burn wave | **200ms** | `PROCESSING_TEXT_BURN_IN_COLOR_DURATION_S`; bright → dim per char |
| Sustain shimmer loop | **5s** | `PROCESSING_TEXT_BURN_SUSTAIN_SHIMMER_S`; `ShinyText` default |

Constants and CSS custom properties **must stay in sync**:

- `PROCESSING_TEXT_BURN_*` in `processing-text-burn-timing.ts`
- `--ptb-*` in `ProcessingTextBurn.css`

### Budget check (rule of thumb)

For a ~25-character status label, total transition time should feel like **status**, not a
**scene**. If a change pushes typical labels well past ~**1s** of visible choreography,
re-check against Carbon’s ~500ms *functional* choreography budget and NN/G’s “don’t make
people wait” guidance — or justify the exception in this doc.

### Chat route loading (thread hydrate)

Full-page wait while `/chat/[slug]` loads — presentation only, not processing labels.

| Token | Value | Rationale |
|-------|-------|-----------|
| Enter | **280ms** | Material short-enter; presence settles, frame is already there |
| Breath | **3.6s** | Organic-presence idle band (2–5s); quiet sustain while hydrating |
| Exit | **180ms** | Faster than enter (design backbone) |

One soft accent presence on the same `Page` chrome as the thread. No spinner, no status copy.
Honor `prefers-reduced-motion` with a static settle (no breath). Constants + CSS vars must stay
in sync (`CHAT_PAGE_LOADING_*` ↔ `--cpl-*`).

### Message receipt (send acknowledgment)

The first indication that the system has the user’s message must paint **on the client** as
soon as the user bubble is in the thread — not after the first stream byte. Round-trip
latency cannot meet this budget on a slow connection.

| Token | Value | Rationale |
|-------|-------|-----------|
| Receipt reaction | **&lt;250ms** | NN/G simple-feedback band; same paint as the optimistic user message |
| First label | **Reading…** | Honest for the first ~200ms; same shape as “Thinking…”, burns cleanly into “Gathering context” |
| Initial burn delay | **0ms** | `ProcessingTextBurn` incoming-initial (no `--ptb-in-delay`) so the first glyph is immediate |

Implementation: [`lib/chat/optimistic-ai-action.ts`](../../lib/chat/optimistic-ai-action.ts) +
`ChatThread` (`status` + standalone tail while the last row is still the user message).

### Showcase replay (scripted demos)

Public `/showcase/*` autoplay loops (e.g. Ergon live board) use a dedicated timing module —
not chat loading burns. Values sit in the same research bands; tune by eye on the page.

| Token | Value | Rationale |
|-------|-------|-----------|
| Composer typing | **35ms**/char | Bottom of typewriter / streaming reveal band |
| Assistant stream | **~36ms**/token | Matches welcome Noesis loop; word-ish tokens |
| Thinking pause | **700ms** | Brief “planning” beat before tools/text |
| Tool in-flight (default) | **900ms** | Long enough to read a compact status row |
| Tool in-flight (INITIATE) | **1600ms** | Full board shell needs a readable beat |
| Chapter / loop holds | **1.4s / 2.8s** | Exit-faster-than-enter; loop hold lets the final view settle |

Constants: [`lib/showcase/replay-timing.ts`](../../lib/showcase/replay-timing.ts). Honor
`prefers-reduced-motion` by snapping to the final frame (see `useReplayClock`).

Living-board motion (Presence / Trace / Field) lives next to the effect in
[`components/chat/kanban/living/living-board-timing.ts`](../../components/chat/kanban/living/living-board-timing.ts)
— card springs, lane folds, wash / spark / orb breaths. Do not put one-off stagger or duration
numbers in JSX.

### Sustain shimmer (activity)

After burn-in settles, sustain uses **`ShinyText`** at `5s` (`PROCESSING_TEXT_BURN_SUSTAIN_SHIMMER_S`)
— the same primitive and speed as legacy `ChatThinking`. Burn chars settle on
`--ptb-shine-dim` (`#b5b5b5`), matching ShinyText at `background-position: 100%`.

### Title regeneration indication

Sidebar and collapsed-thread titles stay in **one line box** (`thread-title` / `thread-title-line`).
The box’s font, padding, truncation, and line-height do not change between states. Only the
affected thread re-renders; regen does not update chat context.

| State | What changes |
|-------|----------------|
| Stable | Current title styling, including the Arcadia gradient when that row uses it |
| Regenerating | Same text node. A shine moves across it (`shine`, 5s). No entrance burn |
| New title | One processing-label burn, old string out and new string in, inside the same line |
| Landed | Back to stable on the new string. The plain text is held until the sidebar cache catches up so the line does not flash the old title |

The burn reuses `ProcessingTextBurn` timing (`processingTextBurnSwapDurationMs`) and settles on
the title’s own color, not the status-label gray. Reduced motion keeps the shimmer class inert
and swaps the string without the character burn.

### Color burn (entry / swap)

Per-character color animation (`--ptb-in-color-duration: 0.2s`): bright leading edge
(`--ptb-shine-bright`, ShinyText highlight) → dim base (`--ptb-shine-dim`). Stagger creates
a visible color-burn wave across the label. No accent pulse on entry.

Opt out of sustain with `sustainShimmer={false}`.

### Accessibility

- Respect `prefers-reduced-motion`: show final text without per-char animation (already
  implemented in `ProcessingTextBurn`).
- Keep a single accessible string (`aria-live` / sr-only full text); do not expose
  character spans to assistive tech as the only content.

### What *not* to do

- Do not replace sustain `ShinyText` with a custom gradient unless matching its stops exactly.
- Do not put one-off stagger/duration numbers in JSX — extend the timing module + CSS vars.
- Do not slow incoming stagger “for drama” on chat loading states without updating this doc
  and the llm-states lab.

---

## Lab verification

1. Open `/sandbox/prototypes/llm-states` → **Processing burn (proto)**.
2. Confirm side-by-side + isolated burn loops feel responsive after rest pauses.
3. Toggle light / dark / reduced motion.
4. If changing tokens, update the lab’s timing reference copy and unit tests in
   `tests/unit/processing-text-burn-timing.test.ts`.

---

## CoreInput layout continuity

CoreInput fits its local container up to `max-w-4xl`; viewport-based width caps must not
subtract a fixed sidebar width or introduce a width cliff at a breakpoint. The existing
`useMorphFlip` wrapper preserves the last visible bottom-left anchor and width through
window resize, CSS resize observations, and React layout commits. New targets retarget the
running morph-physics spring with its velocity intact, so reversing a resize does not restart
or snap the composer. One transform owns the wrapper; CSS owns the final layout. Height-only
growth while typing updates the baseline without an animation.
Height-only viewport changes also land immediately, keeping the composer docked when a
mobile keyboard opens or closes.

`COMPOSER_SHIFT_SPRING` in `lib/chat/composer-shift-spring.ts` uses stiffness 380, damping 36,
and mass 1 for brief motion with little overshoot. Subpixel shifts below 1px do not start a
spring. Reduced motion lands immediately and cancels any active spring. The wrapper keeps
CoreInput mounted, including focus and an unsent draft. No View Transition snapshot or extra
composer instance is needed.

## Usage refresh indicator

The Usage overlay keeps the small uppercase wordmark as `Organic • Usage`, with a 1px,
128px silver line beneath it. A restrained glow uses the wordmark's neutral color. The
line fills linearly toward the next refresh, giving a quiet timing cue without a countdown
label or repeated shimmer. `USAGE_REFRESH_MS` in
`components/usage/usage-refresh-progress.tsx` is 15 seconds; this reflects elapsed time,
rather than a functional transition duration.

The deadline starts after a request settles and resets on range changes, focus, or a return
to a visible tab. Pending requests hold the line full and do not overlap. Hidden and closed
panels skip polling. Reduced motion disables the continuous animation; progress and the
accessible timing label update once per second within the indicator only.

## Usage panel loading

The Usage dialog holds a height of `min(92dvh, 780px)` before and after data arrives; its
body scrolls independently and keeps a stable scrollbar gutter. Initial loads use a custom
dashboard skeleton with the same card borders, responsive totals grid, 120px chart, and
section spacing as the loaded panel. Totals share one card component with a fixed value
line height, and the chart reserves its date-label row even for empty ranges.

Placeholders use the existing neutral, two-second Tailwind opacity pulse and stop animating
under reduced motion. They expose one loading announcement, with decorative placeholders
hidden from assistive technology. They never show fabricated zero usage. Refreshes keep
the previous dashboard mounted; a failed refresh uses an overlaid retry notice so it does
not reflow the content. Initial failures retain the same dialog frame.

## Sources (for re-research)

- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Material 3 — Easing and duration](https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration)
- [IBM Carbon — Motion choreography](https://carbondesignsystem.com/elements/motion/choreography/)
- [Android Compose — Animate text character-by-character](https://developer.android.com/develop/ui/compose/quick-guides/content/animate-text)
- [Motion.dev — Text animation](https://motion.dev/docs/text-animation)
- [NN/G — Animation duration](https://www.nngroup.com/articles/animation-duration/)

When industry guidance shifts, update the tables above and re-validate Organic LLM tokens
against the new bands — do not silently drift production constants.
