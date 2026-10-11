# Activity-mark physics and adaptive fallback

Date: 2026-10-10

The activity mark needs independent dot motion without imposing many frame loops or
layout measurements on a dashboard with multiple agents. The existing v0 SVG grid
must remain usable on constrained devices and under user motion preferences.

Each SVG dot owns a `DotMorphPhysics` instance backed by the existing morph-physics
spring solver. The renderer updates x/y offset, scale, and linked opacity. The package's
React hook is for HTML layout boxes and writes width/height; the SVG consumer uses its
core solver with bounded substeps instead. The package itself is unchanged.

All visible dot instances share one frame scheduler and one performance budget. Physics
loads only after hydration and only when preferences/capabilities permit. A local error
boundary and initialization rejection handling preserve the v0 grid; asynchronous tick
exceptions also stop physics. Sustained cadence/update-cost failures notify all mounted
physics marks and prevent later marks from restarting expensive animation until reload.
Reduced motion and Lightweight Mode choose v0 immediately; changing preferences disposes
the physics renderer. Existing identity-image support and the top glass layer remain.

The [design contract](../../design/subagent-identity-mark.md) owns the exact motion
parameters, thresholds, preference behavior, and measured CPU figures. The benchmark is
reproducible with `scripts/benchmark-agent-dot-physics.ts` and excludes browser rendering.
The runtime cadence guard is also a proxy, not a compositor or battery measurement.

Tests cover numeric stability across states and frame rates, independent instances,
retargeting continuity, final settling, one shared scheduler, visibility cleanup,
sticky failure delivery, actual SVG updates, SSR equivalence, preference switching,
and chunk/render failures. No new dependency or morph-physics package change is required.
