---
name: nebulae-morph-physics
description: >-
  Implements spring-driven layout morphs (Vector4 x,y,w,h) via npm package
  @organic-llm/morph-physics (llm/morph-physics) and optional color/WebGL sync.
  Grounds transitions in Organic LLM design tokens (globals.css, glass primitives,
  rabbit-hole designTokens), Framer coexistence on homepage shells, and
  prefers-reduced-motion. Use when the user asks for morph physics, spring
  morphing, FLIP-style layout transitions, useMorphPhysics, morph-lab, or
  multi-state shell transitions (homepage, chat, rabbit hole, full view, strata).
---

# Nebulae morph physics (UI transitions)

## Source of truth

**Shipped package (use in Organic LLM):**

| Area | Path / import |
|------|----------------|
| Package root | `llm/morph-physics/` — npm name `@organic-llm/morph-physics` |
| Core API | `import { … } from "@organic-llm/morph-physics"` — includes `suggestLayoutConstraintRelaxation`, `ShellLayoutInfo` types (if the bundler does not resolve those from the root `.d.ts`, use `import type { ShellLayoutInfo } from "@organic-llm/morph-physics/layout-relaxation"`) |
| React hook | `import { useMorphPhysics } from "@organic-llm/morph-physics/react"` |
| WebGL helpers | `import { … } from "@organic-llm/morph-physics/webgl"` |

Local install: `"@organic-llm/morph-physics": "file:./llm/morph-physics"` in app `package.json`.

**Upstream reference** (Project Nebulae — for diffing or demos only):

| Area | Path |
|------|------|
| Hook (original) | `.project-references/nebulae/src/experiments/morph-lab/hooks/useMorphPhysics.ts` |
| Demo (FLIP + state machine) | `.project-references/nebulae/src/experiments/morph-lab/MorphTestContainer.tsx` |
| Morph test sources (ported) | `.project-references/nebulae/src/lib/morphTest/` |
| Architecture notes | `.project-references/nebulae/docs/morph-architecture-diagrams.md` |

## Mental model

1. **`Vector4` geometry**: `{ x, y, w, h }` in pixels. Position is applied as `translate(x,y)`; size as `width` / `height` (see `position` property).
2. **Springs**: Each of `x, y, w, h` is a 1D damped spring (`stiffness`, `damping`, `mass`). `deltaTime` is **milliseconds**; the solver divides by 1000 internally.
3. **`FrameLoop`**: `requestAnimationFrame` driver; **caps dt at 100ms** to avoid instability after tab backgrounding.
4. **Settling**: Loop stops when registered properties report settled (position uses L1 error + L1 velocity vs `precision`).
5. **Extensibility**: New animated facets = new `MorphProperty` + `morphPropertyRegistry.registerProperty`. Color exists; per-property velocity for non-position fields is still limited (see comments in `updateMorphState`).
6. **Inner max-width / max-height vs shell**: While morphing **toward** a smaller box, children with `max-w` / `max-h` can render at the resting cap inside a shell that is still **interpolated larger**. The package exposes **`suggestLayoutConstraintRelaxation(current, target, { epsilon })`** (`@organic-llm/morph-physics`) and optional **`onShellLayout`** on `useMorphPhysics`, which fires on each meaningful change (including **synchronously after `morphTo`** and after `reset`) with `{ current, target, settled, relaxation: { width, height } }`. Loosen inner CSS while `relaxation.width` / `relaxation.height` is true; the hook dedupes callbacks when those values and geometry signature are unchanged.

## Organic LLM design foundation

Morphs should **read as native Organic LLM**, not a foreign animation pasted on top.

1. **Semantic surfaces**: Prefer theme tokens from `styles/globals.css` (mapped in `@theme inline` / `:root`) and Tailwind semantic utilities (`bg-background`, `border-border`, `text-foreground`, `rounded-*` aligned with `--radius`). For frosted shells, compose with `glass` or `glassPreview` from `components/design-system/primitives.ts`. **Do not drive `backdrop-filter` or heavy blur on the same node that physics is resizing**; `glassPreview` explicitly avoids animating backdrop-filter — keep blur static, animate layout/opacity on wrappers or children.
2. **Feature-local layout**: When a morph lands in **Rabbit Hole** explorer UI, honor `lib/rabbit-holes/designTokens.ts` (`layout.gridCols`, `card`, typography bundles) so geometry and padding match existing pages.
3. **One owner per layer**: `components/pages/home-page-shell.tsx` already uses Framer `LayoutGroup` and springs such as `HOME_LAYOUT_SPRING` / `FULL_VIEW_CHROME_SPRING`. **Never** combine Nebulae inline `transform` + `width`/`height` on the **same** element as Framer layout animations targeting the same properties. Choose physics **or** Framer for that shell node; use the other for nested content only.
4. **Feel calibration**: House springs are relatively snappy (high stiffness, moderate damping, mass ~1). Use `regular_spring_config` from `@organic-llm/morph-physics` as a closer baseline than `DEFAULT_SPRING_CONFIG` (`slow_spring_config`) when matching homepage/chat chrome. Tune by eye after side-by-side comparison.
5. **Reduced motion**: Respect `prefers-reduced-motion` using `useReducedMotion` from `framer-motion` (see `app/sandbox/prototypes/strata/_components/strata-shell/useStrataShellController.ts`). If true: skip starting `FrameLoop`; `reset(finalTarget)` once to the committed layout.
6. **Mode anchors in-repo**: Map states to real shells — `HomePageShell` + `AIInput` (homepage / full view), `components/chat/core-input.tsx` (chat thread composer), rabbit hole routes + `designTokens`, `StrataShell` / `useStrataShellController` (strata prototype).

More detail: [reference.md — Organic LLM foundation](reference.md#organic-llm-design-foundation-expanded).

## Multi-state transitions (homepage, chat, rabbit hole, full view, strata)

Treat each distinct layout as a **discriminated UI mode**, not a route-only concept.

1. **Single morph element**: One `ref` forwarded to the piece that should move/resize (e.g. wrapped core input chrome).
2. **Stable container**: A positioned parent used as the snapshot origin (`snapshot(element, container)`).
3. **FLIP-style handoff** (match `MorphTestContainer`):
   - On mode change, in **`useLayoutEffect`** (after React commits the new subtree): `clearInlineStyles` on the morph node, force layout read (`offsetHeight`), `snapshot` **next** geometry.
   - Keep **`prevRect`** from the last committed layout.
   - First paint: `reset(next)` to seed physics.
   - Later modes: set target with `morphTo({ x: 0, y: 0, w: next.w, h: next.h })` when positions are container-relative at rest (same pattern as the demo), or compute explicit `x,y` offsets if the design needs absolute targets.
4. **Spring tuning**: Start from `DEFAULT_SPRING_CONFIG` or `SPRING_PRESETS` from `@organic-llm/morph-physics`. Snappier → higher `stiffness` or lower `mass`; less bounce → higher `damping`. Coarser stop → raise `precision` slightly.
5. **Cross-fade vs morph**: Prefer **one** continuous morph layer for spatial continuity; use opacity/content swaps on inner children if the outer shell morphs.

## Operations checklist

When implementing or debugging:

- [ ] `elementRef` attaches to the node receiving `transform` + size.
- [ ] Container ref matches the coordinate system for `snapshot`.
- [ ] `useLayoutEffect` dependencies include the mode key and stable `morphTo` / `reset` (memoized in hook).
- [ ] No CSS transitions fighting inline `transform` / `width` / `height` on the morph node.
- [ ] No double-driving layout with Framer `motion` layout props on that same node.
- [ ] `useReducedMotion` → instant settle or no `FrameLoop`.
- [ ] Glass / chrome: blur tokens static on the morphing layer; motion on geometry or inner content.
- [ ] Optional **`onShellLayout`** (or `suggestLayoutConstraintRelaxation`) when swapping inner trees with **max-w/max-h** smaller than the source shell during a shrink morph.

## Porting snippet

Minimal consumption pattern:

```tsx
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { DEFAULT_SPRING_CONFIG } from "@organic-llm/morph-physics";

const { elementRef, reset, morphTo } = useMorphPhysics({ config: DEFAULT_SPRING_CONFIG });
// useLayoutEffect: clear → measure → reset | morphTo
```

For full FLIP sequencing, see Nebulae demo `.project-references/nebulae/src/experiments/morph-lab/MorphTestContainer.tsx` — mirror its `prevRect` / `snapshot` / `clearInlineStyles` flow.

## Deeper reference

Step-by-step recipes and pitfalls: [reference.md](reference.md).
