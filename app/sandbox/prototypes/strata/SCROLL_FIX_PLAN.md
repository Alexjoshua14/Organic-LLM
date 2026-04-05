# Fix Strata Scroll Jank

## Root Cause Diagnosis

The current scroll implementation in [`StrataShell.tsx`](app/sandbox/prototypes/strata/_components/StrataShell.tsx) suffers from **two scroll control systems fighting each other**. Here is what is happening:

### The conflict

The scroll container (line 596-598) has **CSS scroll snap** applied:

```
className="min-h-0 flex-1 w-full overflow-y-auto scroll-smooth snap-y snap-proximity scroll-py-4"
```

At the same time, a **JavaScript gesture system** (lines 210-328) intercepts wheel and touch events and calls `container.scrollTo({ behavior: "smooth" })`. These two systems conflict:

1. **CSS `snap-proximity`** nudges scroll position toward snap points passively.
2. **JS `scrollTo()`** imperatively jumps to the next section.
3. Both fire on the same gesture, causing stutter and double-animation.

### Additional issues

- **`snap-always` on children + `snap-proximity` on parent**: `SectionCard.tsx` uses `snap-start snap-always` (line 34), but the container uses `snap-proximity`. `snap-always` is designed for `mandatory` mode; with `proximity`, the browser may or may not honor it, creating inconsistent behavior.
- **`scroll-smooth` on container**: This CSS property makes ALL scroll operations smooth, including CSS snap corrections. When the JS handler also passes `behavior: "smooth"`, there is redundant/conflicting smoothing.
- **Non-passive wheel listener**: `{ passive: false }` on line 319 blocks the compositor thread from scrolling ahead of the main thread, causing visible frame drops.
- **560ms gesture cooldown**: `GESTURE_COOLDOWN_MS = 560` locks out all scroll input after a snap, making the UI feel unresponsive.
- **No `overscroll-behavior: contain`**: Scroll can chain to the parent document, causing the page itself to scroll when a section boundary is reached.
- **High thresholds**: `WHEEL_DELTA_THRESHOLD = 330` and `WHEEL_VELOCITY_THRESHOLD = 3.45` mean moderate scroll gestures are ignored by JS but still trigger CSS snap-proximity awkwardly.

---

## Industry Study

### Apple (Product Pages)

- **No snap**: Content scrolls freely and naturally.
- **Scroll-driven animations**: Elements animate in/out as the user scrolls, using CSS `animation-timeline: scroll()` running entirely on the compositor thread (no main-thread JS).
- **Parallax layering**: Different content layers move at different speeds for depth.
- Scroll is never locked or intercepted; the browser owns 100% of scroll physics.

### TikTok / YouTube Shorts

- **Full-viewport cards** with `scroll-snap-type: y mandatory` -- pure CSS, no JS intervention for snap behavior.
- **Virtualization**: Only 3-5 DOM nodes rendered at a time via a virtual scroll engine.
- **`overscroll-behavior: contain`** to prevent scroll chaining.
- **No JS scroll handlers** for the snap itself; JS only handles lazy-loading and analytics.

### Google / Material Design

- **Content scrolls freely** under fixed/collapsing app bars.
- **`overscroll-behavior: contain`** on all scroll containers.
- **IntersectionObserver** for all visibility-driven UI (toolbar show/hide, lazy loading).
- **Passive event listeners** everywhere; never `preventDefault()` on scroll.

### Common Principles Across All

- **Never fight native scroll** -- Let the browser/compositor own scroll physics.
- **One system owns snap** -- Either CSS snap OR JS snap, never both.
- **Compositor-thread animations** -- CSS transforms + `will-change`, not JS.
- **`overscroll-behavior: contain`** -- Prevent parent scroll chaining.
- **Passive listeners only** -- Let the compositor scroll immediately.
- **IntersectionObserver for visibility** -- Avoid scroll-position calculations on main thread.

---

## Three Proposed Approaches

### Approach A: Pure CSS Scroll Snap (TikTok/Shorts Model)

**Philosophy**: Remove all JavaScript scroll/gesture handling. Let the browser's native CSS scroll snap engine own scroll physics entirely. This is the simplest and most performant option.

**Changes**:

- Remove the entire `useEffect` block (lines 210-328) that handles wheel/touch events.
- Remove all gesture-related refs and constants (`wheelStateRef`, `touchStateRef`, `gestureLockUntilRef`, all threshold constants).
- Remove `canScrollableElementContinue()` helper.
- Change scroll container classes from `snap-y snap-proximity scroll-smooth` to `snap-y snap-mandatory`.
- Remove `scroll-smooth` (CSS snap has its own smooth behavior; adding this causes double-smoothing).
- Add `overscroll-behavior-y: contain` to prevent scroll chaining.
- Keep `snap-start snap-always` on section cards (now correctly paired with `mandatory`).
- Keep the existing `IntersectionObserver` for sticky generate button visibility.

**Pros**:

- Zero JS scroll logic. Entire system runs on compositor thread at 120fps.
- Dramatically simpler code (~120 lines removed).
- Consistent behavior across devices and input methods (trackpad, mouse wheel, touch).
- Native momentum and deceleration curves match OS conventions.

**Cons**:

- Less control over scroll feel. The browser decides snap speed and easing.
- `mandatory` can feel aggressive if section cards are much taller than viewport.
- Textareas with scrollable content inside sections may require `overscroll-behavior: contain` on themselves to avoid accidental section jumps.

**Best for**: A clean, reliable, "it just works" experience. Matches how TikTok/Shorts achieves buttery vertical card navigation.

---

### Approach B: Free Scroll with Scroll-Driven Animations (Apple Model)

**Philosophy**: Remove snap entirely. Let content scroll freely and continuously. Use CSS scroll-driven animations or IntersectionObserver to create elegant entrance/exit transitions as sections come into and leave the viewport.

**Changes**:

- Remove all snap-related CSS classes (`snap-y`, `snap-proximity`, `snap-start`, `snap-always`).
- Remove all JS gesture handling (same as Approach A).
- Remove `scroll-smooth` from the container.
- Add `overscroll-behavior-y: contain`.
- Add CSS `@keyframes` for section entrance effects (fade-in, slide-up, scale) tied to `animation-timeline: view()` on each section card.
- Add a subtle scroll progress indicator (thin bar or dot navigation on the side).
- Keep IntersectionObserver for sticky generate visibility.
- Optionally add `scroll-padding-top` to account for the header/nav area.

**Pros**:

- Smoothest possible scroll -- zero snap friction, pure native scroll physics.
- Rich visual storytelling as sections animate in (Apple-style polish).
- No section-height constraints; long Elaborated content scrolls naturally.
- Most forgiving for mixed-height content.

**Cons**:

- CSS `animation-timeline: view()` has limited browser support (Chrome 115+, Safari 26+, no Firefox yet). Would need a JS fallback (IntersectionObserver + CSS class toggling) for full browser coverage.
- No automatic section alignment; users can stop between sections.
- Slightly more CSS to write for the animation keyframes.

**Best for**: A polished, editorial feel where content length varies and sections should flow like a magazine/product page. Matches Apple's storytelling scroll aesthetic.

---

### Approach C: Refined JS-Assisted Snap (Fixed Hybrid)

**Philosophy**: Keep the current JS-assisted snap concept but fix the fundamental conflict: **JS owns snap entirely, CSS does not snap**. This preserves the custom tuning ability while eliminating the two-system fight.

**Changes**:

- Remove all CSS snap classes (`snap-y`, `snap-proximity`, `snap-start`, `snap-always`) from container and children.
- Remove `scroll-smooth` from the container (JS controls smoothness via `scrollTo`).
- Add `overscroll-behavior-y: contain` to the scroll container.
- Rewrite the wheel handler to be **passive** (`{ passive: true }`) and accumulate delta in a `requestAnimationFrame` loop instead of calling `scrollTo` directly from the event.
- Reduce `GESTURE_COOLDOWN_MS` from 560ms to ~300ms.
- Lower `WHEEL_DELTA_THRESHOLD` from 330 to ~150 and `WHEEL_VELOCITY_THRESHOLD` from 3.45 to ~2.0 for more responsive snapping.
- Use `requestAnimationFrame`-driven spring/lerp animation for the snap scroll instead of `scrollTo({ behavior: "smooth" })` for more control over easing.
- Add `will-change: scroll-position` to the scroll container for GPU compositing hints.
- Add keyboard navigation (arrow keys, Page Up/Down) for accessibility.

**Pros**:

- Full control over snap feel, easing curves, and thresholds.
- Can implement custom physics (spring, friction) for a distinctive feel.
- Works in all browsers without compatibility concerns.

**Cons**:

- Most complex of the three approaches. More code to maintain.
- Any main-thread JS in the scroll path risks jank under load (e.g., during AI generation).
- Must be carefully tuned per input device (trackpad vs. mouse wheel vs. touch).

**Best for**: When you want a bespoke, highly tuned scroll experience and are willing to invest in ongoing tuning. Closest to the current approach but correctly implemented.

---

## Recommendation

**Approach A (Pure CSS Snap)** is the strongest starting point. It eliminates ~120 lines of fragile JS, runs entirely on the compositor thread, and matches the proven TikTok/Shorts pattern. The only real risk is textareas-inside-snapped-sections, which is solved with `overscroll-behavior: contain` on the textarea elements.

If the team later wants richer scroll effects (parallax, entrance animations), elements of Approach B can be layered on top of A without conflict.
