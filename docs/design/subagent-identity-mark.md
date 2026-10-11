# Subagent identity mark

The empty identity slot in full and compact Arcadia cards uses a locally isolated,
layered mark. Existing stored identity images render inside the same lower layer,
with the glass cover above them as well.
These are the first two layers of the user-directed redesign; further layers are pending.

- **z-0:** a full-size HTML layer containing `AgentDotGrid`, a full-size SVG with 18
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

## Motion API

`AgentDotGrid` and `SubagentIdentityMark` accept `state`:

| Verb | Behavior | Approved timing and amplitude |
|------|----------|-------------------------------|
| `idle` | Independent smooth random size jitter | ±5–15%; 12–20s per eight-target cycle |
| `working` | Faster, larger independent jitter | ±20–35%; 4.8–7.2s per eight-target cycle |
| `waiting` | Shared slow breathing | ±7%; 5s cycle |
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
