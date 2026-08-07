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
| Incoming opacity settle | **250ms** | Material enter short-band; was 800ms (too decorative) |

Constants and CSS custom properties **must stay in sync**:

- `PROCESSING_TEXT_BURN_*` in `processing-text-burn-timing.ts`
- `--ptb-*` in `ProcessingTextBurn.css`

### Budget check (rule of thumb)

For a ~25-character status label, total transition time should feel like **status**, not a
**scene**. If a change pushes typical labels well past ~**1s** of visible choreography,
re-check against Carbon’s ~500ms *functional* choreography budget and NN/G’s “don’t make
people wait” guidance — or justify the exception in this doc.

### Sustain shimmer (activity)

After burn-in settles, status labels keep a **subtle ShinyText shimmer** (`speed` 1.2s —
legacy ChatThinking cadence) so in-flight tool/processing states still feel alive. Burn
handles state *changes*; shimmer handles *ongoing* work. Disabled under reduced motion.
Opt out with `sustainShimmer={false}` on `ProcessingTextBurn`.

### Accessibility

- Respect `prefers-reduced-motion`: show final text without per-char animation (already
  implemented in `ProcessingTextBurn`).
- Keep a single accessible string (`aria-live` / sr-only full text); do not expose
  character spans to assistive tech as the only content.

### What *not* to do

- Do not reintroduce long ShinyText-only status without a documented exception.
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

## Sources (for re-research)

- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Material 3 — Easing and duration](https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration)
- [IBM Carbon — Motion choreography](https://carbondesignsystem.com/elements/motion/choreography/)
- [Android Compose — Animate text character-by-character](https://developer.android.com/develop/ui/compose/quick-guides/content/animate-text)
- [Motion.dev — Text animation](https://motion.dev/docs/text-animation)
- [NN/G — Animation duration](https://www.nngroup.com/articles/animation-duration/)

When industry guidance shifts, update the tables above and re-validate Organic LLM tokens
against the new bands — do not silently drift production constants.
