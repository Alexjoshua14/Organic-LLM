# Adaptive Liquid Chrome

A full-viewport animated background that **dims when the user hovers or focuses** designated UI areas (e.g. the main input or sandbox button), then **brightens back in two phases** with distinct timing and easing. It uses the [LiquidChrome](https://github.com/reactbits/liquid-chrome) shader for the base animation and layers an opacity transition on top.

## Purpose

- **Focus attention** — Dimming the background when the user hovers or focuses a control makes the rest of the UI recede and signals “you have my attention.”
- **Return to rest** — Brightening starts **immediately** when hover/focus ends (no delay). It moves **quickly to 65%** opacity, then **slowly the rest of the way** to full brightness, evoking “the LLM is awaiting your interaction” without feeling rushed.

## Usage

1. Render `AdaptiveLiquidChrome` as a full-viewport layer (e.g. on the home page).
2. Add **`data-dim-background`** to any element that should trigger dimming on hover/focus (e.g. the main input wrapper or a button).
3. For a **stronger dim** (e.g. ~40% opacity), use **`data-dim-background="full"`** on that element; otherwise the default dim intensity is used.

```tsx
<AdaptiveLiquidChrome dimIntensity={0.45} />

<div data-dim-background>
  <Input placeholder="Focus or hover to dim the background" />
</div>

<Link href="/sandbox" data-dim-background="full">Sandbox</Link>
```

## Props

| Prop | Default | Description |
|------|---------|-------------|
| `speed` | `0.012` | Speed of the underlying LiquidChrome morph animation (lower = slower). |
| `dimOnHover` | `true` | Whether hover/focus triggers dimming. |
| `dimIntensity` | `0.7` | Dim amount for `data-dim-background` (0–1). e.g. 0.45 → 55% opacity when dimmed. |
| `dimIntensityFull` | `0.6` | Dim amount for `data-dim-background="full"` (e.g. ~40% opacity). |
| `dimTransitionMs` | `700` | Duration (ms) for **dimming** (hover/focus in). Quick response. |
| `to65TransitionMs` | `1200` | Duration (ms) for **phase 1 brightening**: dimmed → 65% opacity. Quickish, still slower than dim. |
| `to100TransitionMs` | `2800` | Duration (ms) for **phase 2 brightening**: 65% → 100%. Slow, ease. |
| `onDimChange` | — | Callback when dimmed state changes (e.g. for debugging or a dim indicator). |

## Brightening behavior

- **No rest delay** — As soon as hover and focus leave the dim areas, brightening starts.
- **Phase 1** — Opacity animates from the current dimmed value to **65%** over `to65TransitionMs`, with ease interpolation.
- **Phase 2** — After phase 1, opacity animates from 65% to **100%** over `to100TransitionMs`, with ease interpolation.

If the user hovers/focuses again during phase 1 or 2, the background dims again immediately (phase 2 timeout is cleared).

## Easing

Transitions use a single cubic-bezier for now: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`. Future refinement could use separate curves per phase (e.g. sharper “respond” for dim, “long exhale” for phase 2).

## Implementation notes

- **Brightness state** is one of: `dimmed` | `to65` | `rest`. The wrapper div’s opacity is derived from this and `effectiveDimIntensity`.
- **Event handling** — Global `focusin` / `focusout` and per-element `mouseenter` / `mouseleave` on `[data-dim-background]`. A `MutationObserver` attaches listeners to new matching elements.
- **Theme** — Base color and opacity of the LiquidChrome layer respect `next-themes` (dark: deep blue-gray, light: warm gray).

## File location

- Component: `components/background/AdaptiveLiquidChrome.tsx`
- LiquidChrome shader: `components/third-party/reactbits/LiquidChrome/`
