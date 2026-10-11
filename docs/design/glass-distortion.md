# Glass distortion

`GlassBackdrop` is an opt-in companion to `glass()`. Wrap background content that
the component owns, then put a separate glass surface and foreground UI above it:

```tsx
import { GlassBackdrop } from "@/components/design-system/glass-backdrop";
import { glass } from "@/components/design-system/primitives";

<div className="relative isolate overflow-hidden rounded-xl">
  <GlassBackdrop distortion className="absolute inset-0">
    {ownedBackground}
  </GlassBackdrop>
  <div className={`${glass()} relative z-10 p-4`}>{foreground}</div>
</div>;
```

`distortion?: boolean` defaults to `false`; ordinary div props are preserved.
Disabled instances mount no SVG filter. Server output and the first client render
keep the undistorted source; eligibility is checked after mount. Each enabled
instance has a stable, unique React ID.

The source uses regular CSS `filter: url(...)` with `SourceGraphic`, rather than
an SVG URL in `backdrop-filter`. SVG backdrop references remain incomplete in
[Safari](https://bugs.webkit.org/show_bug.cgi?id=245510); regular source filtering
avoids that path. See [CSS filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter).
This can refract owned dots or images, not arbitrary DOM behind the wrapper.
Foreground text and controls stay outside the filtered source.

The shared static SVG helper uses two octaves of fractal noise, softened before
displacement. `GlassBackdrop` selects frequency .035 and displacement scale 6
for gentle bends; the older glass lab retains its .012/14 defaults. There are no
extra animation frames, timers, or per-frame React updates. Animated sources still
incur browser raster/compositing work, which the activity lab's animation-JS
measurements cannot attribute.

Lightweight Mode, reduced motion, reduced transparency, increased contrast, or
unavailable preference/filter APIs disable refraction. Preference changes apply
live, including cross-tab settings changes. CSS parsing support is an eligibility
check, not a pixel-rendering test. DOM tests verify delivery, preferences, and
lifecycle; they do not measure native Safari/Chrome rendering or GPU cost.

`OrganicActivityMark` exposes `glassDistortion?: boolean`, also off by default.
The **Distortion** switch in `/sandbox/prototypes/organic-agent` applies across all
states, renderers, and the transition preview without remounting the dot instances.
Toggling starts a fresh performance sample set. Strong diffusion can obscure the
small bends; use a low blur while inspecting refraction.
