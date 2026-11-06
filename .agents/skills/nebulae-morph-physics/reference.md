# Nebulae morph physics — reference

## Organic LLM design foundation expanded

### Authoritative style sources (read before shaping targets)

| Concern | Location |
|--------|----------|
| Theme / semantic colors, radius | `styles/globals.css` (`:root`, `@theme inline`) |
| Glass & editorial surfaces | `components/design-system/primitives.ts` (`glass`, `glassPreview`; `glassPreview` documents constraints — cheap transforms/opacity/shadow, not animated `backdrop-filter`) |
| Homepage shell layout & Framer springs | `components/pages/home-page-shell.tsx` (`HOME_LAYOUT_SPRING`, `FULL_VIEW_CHROME_SPRING`, `LayoutGroup id="homepage"`, `fullViewGutterX`) |
| Composer variant props | `components/chat-experimental/ai-input.tsx` (consumed by `HomePageShell` as `AIInput`) |
| Chat composer | `components/chat/core-input.tsx` (Framer usage — coordinate layers) |
| Rabbit Hole grid / cards / type | `lib/rabbit-holes/designTokens.ts` |
| Strata shell + reduced motion | `app/sandbox/prototypes/strata/_components/strata-shell/useStrataShellController.ts` |

### Principles

- **Continuity**: The user should recognize the same “input lens” across modes; change **geometry and context**, not arbitrary visual language per route.
- **Performance**: Favor morphing **layout boxes**; keep expensive materials (blur, large shadows) on static or minimally animated layers.
- **Coexistence with Framer**: Framer is already the house solution for homepage chrome motion. If Nebulae physics is adopted for **shared cross-route** morphs (e.g. composer chrome), extract a **single** wrapper whose layout is owned by physics **or by** `motion.div` layout — not both on the same computed box.

### Spring feel vs homepage

The Nebulae reference `regular_spring_config` (same values in `@organic-llm/morph-physics`) uses `stiffness: 170`, `damping: 26`, `mass: 1` — use that as a first pass when physics-driven morphs must sit beside homepage timings. Calibrate in-product; the integrators differ.

### Reduced motion implementation sketch

```tsx
import { useReducedMotion } from "framer-motion";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";

const reduce = useReducedMotion();
const { elementRef, reset, morphTo } = useMorphPhysics({ config });

// On mode change after measure:
if (reduce) {
  reset(nextRect);
} else {
  morphTo(nextRect);
}
```

Ensure focus order and visibility remain valid after the morph (no off-screen focus traps).

## Equations (for reasoning about feel)

Per scalar: acceleration \(a = (-k(x - x_t) - c v) / m\), then semi-implicit Euler with \(dt\) in **seconds** (`deltaTime_ms / 1000`). Implemented in `springSolver.ts` as `solveSpring` / `solveSpringVector4`.

## FLIP-style mode switch (recommended)

Follow `MorphTestContainer.tsx`:

1. React renders the **new** mode (new children/markup) into the same morph `ref`.
2. **`useLayoutEffect`** runs before paint:
   - `clearInlineStyles(morphEl)` so layout reflects CSS, not stale inline morph.
   - Read layout (`offsetHeight` or equivalent) to flush.
   - `next = snapshot(morphEl, containerEl)`.
3. If `prevRect` is set: `morphTo({ x: 0, y: 0, w: next.w, h: next.h })` (demo assumes translated rest at container origin). Otherwise `reset(next)` to seed.
4. Assign `prevRect.current = next`.

Adjust `x,y` when the resting layout is **not** `(0,0)` relative to the container—derive from `prevRect` and `next` deltas.

## organic-llm integration map

Use one **mode enum or string union** for the shell, e.g. `'homepage' | 'full-view' | 'chat' | 'rabbit-hole' | 'strata'`.

Suggested wiring locations (verify in-tree as the app evolves):

- Shared input chrome: `components/chat/core-input.tsx`, `components/chat-experimental/ai-input.tsx`.
- Page shells: `components/pages/home.tsx`, `components/pages/home-page-shell.tsx`, `app/sandbox/prototypes/strata/_components/StrataShell.tsx`.

Keep **mode** in a parent shell; pass **layout props** or **slot content** down. The morph hook stays close to the single DOM node that should carry `transform` + explicit `width`/`height`. Imports: `useMorphPhysics` from `@organic-llm/morph-physics/react`, core helpers from `@organic-llm/morph-physics`. Apply the **Organic LLM design foundation** section above so landed rects honor tokens and feature layouts.

## Custom `MorphProperty` sketch

1. Implement `MorphProperty<T>` (see `llm/morph-physics/src/morphProperties/types.ts`) with `key`, `schema`, `extractFromElement`, `applyToElement`, `updateState`, get/set current/target, optional `isSettled`, `solveSpring`.
2. Register in `llm/morph-physics/src/morphProperties/index.ts` (or call `morphPropertyRegistry.registerProperty` at runtime).
3. If the property needs its own velocity, extend `morphCurrentState` / `updateMorphState` per comments in `llm/morph-physics/src/morphUtils.ts` (today position owns `state.velocity` as `Vector4`).

## Pitfalls

- **CSS transitions** on the same properties the hook sets inline → conflict; remove or scope transitions to inner nodes.
- **`precision` too small** → long tail frames; too large → visible snap.
- **Unmount during animation**: hook `useEffect` cleanup stops `FrameLoop`; ensure no stale refs if the morph node unmounts mid-gesture.
- **Color / brightness**: registered modules exist; confirm `isSettled` behavior across **all** properties or the loop may never stop.

## GPU / Three path

See `MorphTestContainerGPU.tsx`: pass `webGLRef` into `useMorphPhysics`; `updateWebGLMesh` pushes rect + velocity into uniforms.
