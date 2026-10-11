# Subagent identity mark

The empty identity slot in full and compact Arcadia cards uses a locally isolated,
layered mark. Existing stored identity images render inside the same lower layer,
with the glass cover above them as well.
These are the first two layers of the user-directed redesign; further layers are pending.

- **z-0:** a full-size HTML layer containing an adaptive full-size SVG with 18
  dots in six rows: 1, 3, 5, 5, 3, 1 (or the existing identity image when present).
- **z-1:** a full-cover, absolutely positioned `glass()` surface. Its existing blur,
  tint, and border provide diffusion; the consumer adds positioning and inherited
  rounding, without another material or filter.

The two layers are HTML siblings with explicit local z-indices. The cover always
renders last, above the lower layer; nested SVG/glass content cannot paint above it.

[`OrganicActivityMark`](../../components/agents/organic-activity-mark.tsx) owns the
entire stack. Other app surfaces render this single component; `SubagentIdentityMark`
is a thin adapter supplying the agent's accessible label and identity seed.

```tsx
import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";

<OrganicActivityMark state="working" size="md" seed="researcher" />;
```

Sizes are 32, 40, and 56px (`sm`, `md`, `lg`); `className` can override dimensions.
An optional `label` gives the mark image semantics; otherwise it is decorative.
Callers do not need to mount filters, schedule animation, or arrange layers.
`renderer="v0"` selects the original grid for lab comparisons; the default `"auto"`
retains all preference and performance safeguards.

Dots have a native SVG circle and an embedded HTML `glass()` surface using
`foreignObject`: HTML background/backdrop utilities do not paint SVG circles.
Both scale together. At scale 1, opacity is .75. The same size variance drives opacity
piecewise toward .4 at scale .65 and .95 at scale 1.35, clamped at those limits.
Keyframes pass through scale 1 when changing sides of that curve, keeping opacity
linked correctly between targets as well as at the targets themselves.
The reference radius is 2 in a 40×40 viewBox; the layer fills its container at any card size.
Starting sizes combine a gentle radial bias (edge scale .84, center lift up to .26)
with ±.065 soft noise. The stable `seed` keeps SSR and hydration identical and gives
each agent its own pattern. Initial opacity follows initial size. Motion varies around
each dot's individual resting size, with final scales clamped to .65–1.35; the center
bias persists across cycles and after completion rather than returning to a rigid grid.

## V0 fallback motion API

`AgentDotGrid` and `SubagentIdentityMark` accept `state`:

| Verb | Behavior | Approved timing and amplitude |
|------|----------|-------------------------------|
| `idle` | Independent smooth random size jitter | ±5–15%; 12–20s per eight-target cycle |
| `working` | Faster, larger independent jitter | ±20–35%; 4.8–7.2s per eight-target cycle |
| `waiting` | Shared slow breathing | ±10%; 5s cycle |
| `blocked` | Alternating dot groups pulse with pauses | ±18%; 3.6s cycle |
| `complete` | Center-out pulse, then individual resting sizes | +28%; 400ms, 20ms stagger per grid-cell distance |

The first four verbs repeat. Randomized verbs resample every cycle. All keyframe
segments use `cubic-bezier(0.4, 0, 0.2, 1)`; state changes begin at the current painted
size and opacity. Arcadia maps `done` to `complete`; `waiting` is available for later callers.

The shape and size/opacity contract come from the user's grid and motion brief.
Organic's [presence guidance](../organic-presence.md) supplies the slow ambient cadence;
the [motion backbone](./motion-and-text-timing.md) supplies brief functional feedback
and reduced-motion behavior. Continuous breathing is ambient motion, not an interaction
delay. Timing constants live alongside the effect in `agent-dot-grid-motion.ts`.

Native Web Animations update transform and opacity without per-frame React renders.
Offscreen or backgrounded marks pause. State changes and unmount cancel old animations
and remove listeners. Reduced motion renders static dots with their soft starting sizes and responds to preference
changes; browsers without Web Animations retain the same static SVG. Glass also inherits
the primitive's existing reduced-transparency and contrast fallbacks.

Card names and textual status remain the accessible source of agent identity and state;
the animated SVG and glass cover are decorative.

## Independent physics dots

`OrganicActivityMark` now selects its renderer through `AdaptiveAgentDotGrid`.
Server output and the first client render use the v0 grid. Eligible clients load the
physics renderer lazily; callers keep the same public props and the glass stays on top.
The original v0 snapshot remains at Git tag `OrganicAgent-v0`.

Each `PhysicsDot` owns one `DotMorphPhysics` instance with independent x/y offset,
scale, targets, and persistent velocities. It uses the package's `solveSpring` core;
the HTML layout hook is not appropriate for tiny SVG dots. One page-level scheduler
drives all visible instances. Transform and opacity updates avoid width/height layout
and per-frame React renders. Opacity is calculated from each actual spring size.

Physics uses the same five verbs and center-biased resting sizes. Idle retargets every
1.5–2.5s with ±5–15% size variance and at most .2 viewBox units of movement. Working
retargets every .6–.9s with ±20–35% variance and at most .5 units of movement. Waiting
follows a ±10%, 5s breathing target; blocked alternates groups on a 3.6s period. Complete
pulses toward +28% for 160ms with a 20ms/cell center-out stagger, then springs to each
resting size and unregisters when settled. All scale/offset limits apply to actual
positions, not just targets. Springs integrate in steps no larger than 1/120 second
and consume at most 50ms per delivered frame to keep stalls numerically stable.
State changes keep velocity; offscreen and hidden-tab work pauses.

The v0 renderer is selected for reduced motion (static), Lightweight Mode, unsupported
capabilities, chunk/render/initialization errors, and sustained performance pressure.
Lightweight Mode is in quick settings and Settings → Appearance, defaults off, and
uses the existing browser-local settings cache/event path. The Supabase settings
persistence functions remain stubs, so this preference does not currently sync accounts
across devices. Same-tab and cross-tab changes take effect immediately.

Performance constants live in `dot-physics-scheduler.ts`: ignore the first 750ms after
activation/resume; evaluate 2s windows; degrade after two consecutive windows with RAF
cadence below 30fps or average combined physics/DOM-write work above 4ms per frame.
The budget is shared across marks, excludes hidden/offscreen time, and latches across
the page until reload to prevent repeated upgrades. Local renderer failure also stays
in fallback for that mounted mark. A short load/resize stall does not trigger degradation.
RAF cadence is a proxy for rendering pressure; it does not measure compositor-presented
frames or battery use. The fallback retains the shared glass material.

Run `NODE_ENV=production bun scripts/benchmark-agent-dot-physics.ts` for CPU integration
measurements. Three M1 Pro runs measured p95 .0055–.0392ms for one mark (18 dots) and
.0098–.0720ms for five marks (90 dots), against a 16.7ms 60Hz frame budget. This supports
the CPU feasibility of independent springs; it is not a browser/mobile rendering or
battery benchmark. Browser/computer-use verification has not been performed.

See the [technical decision](../architecture/decisions/20261010-activity-mark-physics-and-fallback.md).

## Prototype bench

Open `/sandbox/prototypes/organic-agent` (also listed in the prototype gallery).
All five states use the same resting pattern for comparison. Choose a 28, 40, 56,
or 112px preview; compare adaptive and v0 rendering; replay completion; or generate
a new seed. Each preview reports the renderer actually mounted, including fallback.
The separate transition preview keeps the same instances and velocity as its state
changes; selecting Complete again intentionally restarts that pulse. Controls stay
local to the bench and never rewrite user preferences or bypass reduced motion.

The bench follows the existing LLM-states catalog's production-component fixtures,
the glass lab's paired comparison pattern, and the design backbone's reserved-space
and reduced-motion rules. Its quiet background keeps attention on the mark itself.
