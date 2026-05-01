# Memory ingest (particles) prototype

Ritual surface: one-shot “thought → memory” with **motion as the primary status channel**. Full-screen chat chrome is intentionally absent.

**Layout:** mobile-first (tuned for ~393px phones) with responsive `max-width` and particle height steps from `sm` → `xl` so tablets and desktops get a wider focal column without redesigning the ritual.

## Routes

- Entry: [`/sandbox/prototypes/memory-ingest`](/sandbox/prototypes/memory-ingest) — creates a thread and redirects to `/sandbox/prototypes/memory-ingest/<chatId>`.
- Thread: `/sandbox/prototypes/memory-ingest/[slug]` — loads the thread and mounts the client shell.

## Particle visual vocabulary (v1)

| State               | Meaning                                      |
| ------------------- | -------------------------------------------- |
| `idle_ready`        | Resting, soft drift (same as design name `idle`) |
| `listening`       | Composer has text; subtle pull toward input |
| `ingesting`       | Request in flight / parsing                  |
| `searching_memory`| Memory tool / vector recall                  |
| `reasoning`       | Reasoning stream / heavier tier              |
| `web_search`      | Web search tool                              |
| `writing_memory`  | Receipt / save acknowledgment (~1.2s)      |

Visual motion is driven by the **Memory Lens** engine: [`_lib/lens/recipes.ts`](./_lib/lens/recipes.ts) defines per-state field/modulator targets; [`_lib/lens/state-manager.ts`](./_lib/lens/state-manager.ts) interruptibly lerps recipes over durations from [`_lib/lens/transitions.ts`](./_lib/lens/transitions.ts). [`_components/lens/MemoryLens.tsx`](./_components/lens/MemoryLens.tsx) mounts **React Three Fiber** + a `THREE.Points` shader that composes weighted analytic fields in the vertex shader (see [`_lib/lens/shaders/particle.vert.ts`](./_lib/lens/shaders/particle.vert.ts)).

## Model routing (stub)

[`@/lib/llm/auto-model-router.ts`](../../../../lib/llm/auto-model-router.ts) classifies **reflex** vs **reasoning** from length + keywords, then picks a gateway id honoring **ZDR** via `supportsZeroDataRetention`. Delphi **Auto** (`organic-llm/auto`) is resolved on the server in `/api/chat` using this module. Replace `classifyTaskTier` with a real policy when ready.

## `writing_memory` vs server persistence

The **motion receipt** fires on client `onFinish` when the user had **Memories** enabled. Server-side Mem0 persistence in `/api/chat` may still complete asynchronously; the animation is a deliberate UX acknowledgment, not a strict durability signal.

## Extending states

**LLM-oriented playbook:** [_docs/ADDING_PARTICLE_STATE.md](./_docs/ADDING_PARTICLE_STATE.md) (checklist, file map, pitfalls).

**Living design intent:** [_docs/PARTICLE_STATE_INTENTIONS.md](./_docs/PARTICLE_STATE_INTENTIONS.md) (update when a state’s “why” or feel changes).

1. Add to `ParticleFieldVisualState` in [`_lib/types.ts`](./_lib/types.ts) (same union as `StateName` in [`_lib/lens/fieldLibrary.ts`](./_lib/lens/fieldLibrary.ts)).
2. Add a `StateRecipe` entry in [`_lib/lens/recipes.ts`](./_lib/lens/recipes.ts) and extend unit coverage in `tests/unit/lens-recipes.test.ts` / `tests/unit/lens-state-manager.test.ts` as needed.
3. Map streaming events in [`_lib/memory-ingest-fsm.ts`](./_lib/memory-ingest-fsm.ts) (`mapDataAiActionToIngestEvent` / reducer).
4. If new GPU behavior is needed, add a GLSL chunk under [`_lib/lens/shaders/`](./_lib/lens/shaders/), include it via [`_lib/lens/shaders/buildShader.ts`](./_lib/lens/shaders/buildShader.ts), map weights in [`_lib/lens/uniforms.ts`](./_lib/lens/uniforms.ts), and wire the field name into [`_lib/lens/fieldLibrary.ts`](./_lib/lens/fieldLibrary.ts).

## Reduced motion

When `prefers-reduced-motion: reduce`, the shell renders [`MemoryParticleReducedMotion`](./_components/MemoryParticleReducedMotion.tsx) instead of mounting the WebGL canvas.

## Theme and Organic layout

The ingest shell does **not** paint its own full-page zinc backdrop: it relies on the app [`Page`](../../../../components/layout/page.tsx) **`bg-background`** and semantic text (`text-foreground` on this route). The WebGL renderer clears with **alpha 0** so the canvas stays a transparent layer over the theme.

Particle **tint and opacity** come from a hidden probe with Tailwind **`text-foreground`** inside the particle container; [`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle) returns `rgb` / `rgba` even when tokens are **OKLCH** in CSS. [`_lib/theme-particle-colors.ts`](./_lib/theme-particle-colors.ts) parses that into GPU uniforms (`uParticleTint`, `uParticleAlpha`). A `MutationObserver` on `document.documentElement` class plus the **`organic-llm-settings`** window event re-sync when the theme toggles.

## Upstream parity

The first ingest implementation used Introspection-style `GPUComputationRenderer`; the current **Memory Lens** path uses analytic field composition on a rounded-cube rest lattice via `@react-three/fiber` + custom shaders.

## Dev debug (particle mode overlay)

The **particle mode** dev panel (draggable on the right when dev UI is on) and the **bug** FAB (full state list + pulse) are shown when any of these is true:

1. **`next dev`** — `NODE_ENV` is `development`.
2. **Production build + URL** — append **`?memoryIngestDev=1`** (or `true`) to the thread URL, e.g. `/sandbox/prototypes/memory-ingest/<chatId>?memoryIngestDev=1`. No rebuild required; the shell reads the query on mount.
3. **Production build + env** — set **`NEXT_PUBLIC_MEMORY_INGEST_DEV_UI=true`** (or `1` / `yes`) before **`next build`** so the client bundle includes it, then run `next start`.

`next build` / `next start` alone uses `NODE_ENV=production`, so the overlay is hidden unless you use (2) or (3).

## Perf HUD and stress knobs (dev)

When **`?memoryIngestDev=1`** is on the thread URL, [`MemoryLens`](./_components/lens/MemoryLens.tsx) shows a small **monospace overlay** (fps, mean ms, p95, draw calls, triangle count, particle count, DPR). Stats are written imperatively from the R3F loop so React does not re-render every frame.

- **`?particleCountMul=N`** — only honored together with `memoryIngestDev`; scales the tier default count (clamped to **0.25–6**). Use `&particleCountMul=2` to A/B GPU headroom vs. particle count.
- **`?reactScan=1`** — **`next dev` only**; loads [React Scan](https://github.com/aidenybai/react-scan) from unpkg to highlight unexpected React re-renders. Combine with `memoryIngestDev` as needed; steady-state lens motion should stay quiet in Scan because the hot path is `useFrame`, not React render.

For GPU vs CPU triage, use Chrome **Performance** (GPU track) as described in the lens perf plan.
